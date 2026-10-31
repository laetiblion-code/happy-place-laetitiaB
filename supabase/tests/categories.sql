-- ============================================================
-- Test des catégories de demande
-- À coller dans Supabase > SQL Editor, puis Run.
-- Transaction annulée à la fin (ROLLBACK) : aucune donnée conservée.
-- Résultat attendu : toutes les lignes à « true ».
-- ============================================================
BEGIN;

CREATE TEMP TABLE cat_resultats (n serial, test text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON cat_resultats TO authenticated;
GRANT USAGE ON SEQUENCE cat_resultats_n_seq TO authenticated;

DO $$
DECLARE
  _a text := 'ZZ CAT équipe';
  _id uuid; _m uuid; s1 uuid; _c text;
BEGIN
  INSERT INTO public.teams(name) VALUES (_a);
  INSERT INTO public.allowed_users(email, team) VALUES ('cat.c1@test.invalid', _a) RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'collaborateur');
  INSERT INTO public.allowed_users(email) VALUES ('cat.mgr@test.invalid') RETURNING id INTO _m;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_m, 'manager');
  INSERT INTO public.manager_teams(allowed_user_id, team) VALUES (_m, _a);

  PERFORM set_config('request.jwt.claims', '{"email":"cat.c1@test.invalid"}', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.submissions(author_name, team, content, visibility, category)
      VALUES ('C1', _a, 'CAT demande avec catégorie', 'équipe', 'problème') RETURNING id, category::text INTO s1, _c;
    INSERT INTO cat_resultats(test, ok, detail) VALUES ('Collaborateur : crée une demande avec une catégorie', _c = 'problème', _c);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO cat_resultats(test, ok, detail) VALUES ('Collaborateur : crée une demande avec une catégorie', false, SQLERRM);
  END;
  BEGIN
    INSERT INTO public.submissions(author_name, team, content, category) VALUES ('C1', _a, 'CAT catégorie inconnue', 'urgent');
    INSERT INTO cat_resultats(test, ok, detail) VALUES ('Une catégorie hors des 4 prévues est refusée', false, 'acceptée à tort');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO cat_resultats(test, ok, detail) VALUES ('Une catégorie hors des 4 prévues est refusée', true, 'refusée par la base');
  END;

  PERFORM set_config('request.jwt.claims', '{"email":"cat.mgr@test.invalid"}', true);
  BEGIN
    UPDATE public.submissions SET category = 'idée', status = 'validée' WHERE id = s1;
    INSERT INTO cat_resultats(test, ok, detail) VALUES ('Manager : ne peut pas changer la catégorie', false, 'accepté à tort');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO cat_resultats(test, ok, detail) VALUES ('Manager : ne peut pas changer la catégorie', true, 'refusé par la base');
  END;
  BEGIN
    UPDATE public.submissions SET status = 'validée' WHERE id = s1;
    SELECT category::text INTO _c FROM public.submissions WHERE id = s1;
    INSERT INTO cat_resultats(test, ok, detail) VALUES ('Manager : valide la demande, la catégorie reste la même', _c = 'problème', _c);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO cat_resultats(test, ok, detail) VALUES ('Manager : valide la demande, la catégorie reste la même', false, SQLERRM);
  END;
  RESET ROLE;
END $$;

SELECT test, ok, detail FROM cat_resultats ORDER BY n;
ROLLBACK;
