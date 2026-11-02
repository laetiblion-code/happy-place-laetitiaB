-- ============================================================
-- Test de public.managers_de_mon_equipe()
-- À coller dans Supabase > SQL Editor, puis Run, après la migration.
-- Transaction annulée à la fin (ROLLBACK). Attendu : toutes les lignes à « true ».
-- ============================================================
BEGIN;

CREATE TEMP TABLE mm_resultats (n serial, test text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON mm_resultats TO authenticated;
GRANT USAGE ON SEQUENCE mm_resultats_n_seq TO authenticated;

DO $$
DECLARE
  _id uuid; _n int; _p text;
BEGIN
  INSERT INTO public.teams(name) VALUES ('ZZ Equipe MM1'), ('ZZ Equipe MM2') ON CONFLICT DO NOTHING;

  INSERT INTO public.allowed_users(email, first_name, last_name, team) VALUES ('mm.collab@test.invalid', 'Gaston', 'Test', 'ZZ Equipe MM1') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'collaborateur');
  INSERT INTO public.allowed_users(email, first_name, last_name) VALUES ('mm.manager1@test.invalid', 'Karla', 'Test') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'manager');
  INSERT INTO public.manager_teams(allowed_user_id, team) VALUES (_id, 'ZZ Equipe MM1');
  INSERT INTO public.allowed_users(email, first_name, last_name) VALUES ('mm.manager2@test.invalid', 'Bruno', 'Autre') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'manager');
  INSERT INTO public.manager_teams(allowed_user_id, team) VALUES (_id, 'ZZ Equipe MM2');

  SET LOCAL ROLE authenticated;

  PERFORM set_config('request.jwt.claims', '{"email":"mm.collab@test.invalid"}', true);
  SELECT count(*), max(prenom) INTO _n, _p FROM public.managers_de_mon_equipe();
  INSERT INTO mm_resultats(test, ok, detail) VALUES ('Collaborateur : voit le manager de son équipe', _n = 1 AND _p = 'Karla', _n || ' manager(s), ' || coalesce(_p, 'aucun'));

  SELECT count(*) INTO _n FROM public.managers_de_mon_equipe() WHERE prenom = 'Bruno';
  INSERT INTO mm_resultats(test, ok, detail) VALUES ('Collaborateur : ne voit pas le manager d''une autre équipe', _n = 0, _n || ' ligne(s)');

  PERFORM set_config('request.jwt.claims', '{"email":"externe.inconnu@test.invalid"}', true);
  SELECT count(*) INTO _n FROM public.managers_de_mon_equipe();
  INSERT INTO mm_resultats(test, ok, detail) VALUES ('Compte hors liste blanche : rien', _n = 0, _n || ' ligne(s)');

  RESET ROLE;
END $$;

INSERT INTO mm_resultats(test, ok, detail)
SELECT 'anon ne peut pas exécuter la fonction', NOT has_function_privilege('anon', 'public.managers_de_mon_equipe()', 'EXECUTE'), '';
INSERT INTO mm_resultats(test, ok, detail)
SELECT 'La fonction ne renvoie pas d''e-mail', NOT EXISTS (
  SELECT 1 FROM information_schema.parameters
   WHERE specific_schema = 'public' AND specific_name LIKE 'managers_de_mon_equipe%' AND parameter_mode = 'OUT' AND parameter_name = 'email'), '';

SELECT test, ok, detail FROM mm_resultats ORDER BY n;
ROLLBACK;
