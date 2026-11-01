-- ============================================================
-- Test de l'aide à la rédaction IA : droits et plafond quotidien (T8)
-- À coller dans Supabase > SQL Editor, puis Run.
-- Transaction annulée à la fin (ROLLBACK). Attendu : toutes les lignes à « true ».
-- ============================================================
BEGIN;

CREATE TEMP TABLE ia_resultats (n serial, test text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON ia_resultats TO authenticated;
GRANT USAGE ON SEQUENCE ia_resultats_n_seq TO authenticated;

DO $$
DECLARE _id uuid; _i int; _res jsonb; _err text;
BEGIN
  INSERT INTO public.allowed_users(email, team) VALUES ('ia.collab@test.invalid', 'Product') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'collaborateur');
  INSERT INTO public.allowed_users(email) VALUES ('ia.mgr@test.invalid') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'manager');

  SET LOCAL ROLE authenticated;

  PERFORM set_config('request.jwt.claims', '{"email":"ia.collab@test.invalid"}', true);
  BEGIN
    PERFORM public.reserver_appel_ia('lien');
    INSERT INTO ia_resultats(test, ok, detail) VALUES ('Collaborateur : pas d''accès à l''aide IA', false, 'accepté à tort');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO ia_resultats(test, ok, detail) VALUES ('Collaborateur : pas d''accès à l''aide IA', true, SQLERRM);
  END;

  PERFORM set_config('request.jwt.claims', '{"email":"ia.mgr@test.invalid"}', true);
  _res := public.reserver_appel_ia('pdf');
  INSERT INTO ia_resultats(test, ok, detail) VALUES ('Manager : 1re génération acceptée', (_res->>'restant')::int = 9, _res::text);
  FOR _i IN 2..10 LOOP PERFORM public.reserver_appel_ia('lien'); END LOOP;
  BEGIN
    PERFORM public.reserver_appel_ia('lien');
    INSERT INTO ia_resultats(test, ok, detail) VALUES ('Manager : 11e génération du jour refusée', false, 'acceptée à tort');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO ia_resultats(test, ok, detail) VALUES ('Manager : 11e génération du jour refusée', true, SQLERRM);
  END;
  BEGIN
    INSERT INTO public.ai_requests(user_email, kind) VALUES ('ia.mgr@test.invalid', 'lien');
    INSERT INTO ia_resultats(test, ok, detail) VALUES ('Personne ne peut écrire directement dans le suivi', false, 'accepté à tort');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO ia_resultats(test, ok, detail) VALUES ('Personne ne peut écrire directement dans le suivi', true, 'refusé par la base');
  END;
  RESET ROLE;
END $$;

SELECT test, ok, detail FROM ia_resultats ORDER BY n;
ROLLBACK;
