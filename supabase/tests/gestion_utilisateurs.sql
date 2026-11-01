-- ============================================================
-- Test de la gestion des utilisateurs (T26)
-- À coller dans Supabase > SQL Editor, puis Run.
-- Transaction annulée à la fin (ROLLBACK). Attendu : toutes les lignes à « true ».
-- ============================================================
BEGIN;

CREATE TEMP TABLE gu_resultats (n serial, test text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON gu_resultats TO authenticated;
GRANT USAGE ON SEQUENCE gu_resultats_n_seq TO authenticated;

DO $$
DECLARE
  _id uuid; _res jsonb; _n int; _err text;
BEGIN
  INSERT INTO public.allowed_users(email, team) VALUES ('gu.collab@test.invalid', 'Product') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'collaborateur');
  INSERT INTO public.allowed_users(email) VALUES ('gu.adm@test.invalid') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'admin');

  -- Hook de création de compte
  _res := public.hook_before_user_created('{"user": {"email": "GU.Collab@test.invalid"}}'::jsonb);
  INSERT INTO gu_resultats(test, ok, detail) VALUES ('Lien de connexion : adresse de la liste blanche acceptée', _res = '{}'::jsonb, _res::text);
  _res := public.hook_before_user_created('{"user": {"email": "inconnu@test.invalid"}}'::jsonb);
  INSERT INTO gu_resultats(test, ok, detail) VALUES ('Lien de connexion : adresse inconnue refusée, aucun e-mail', (_res->'error'->>'http_code') = '403', _res::text);

  SET LOCAL ROLE authenticated;

  -- Statut de connexion
  PERFORM set_config('request.jwt.claims', '{"email":"gu.adm@test.invalid"}', true);
  SELECT count(*) INTO _n FROM public.admin_users_status() s WHERE s.email = 'gu.collab@test.invalid' AND NOT s.a_un_compte;
  INSERT INTO gu_resultats(test, ok, detail) VALUES ('Admin : voit « jamais connecté » pour un utilisateur sans compte', _n = 1, _n || ' ligne(s)');
  PERFORM set_config('request.jwt.claims', '{"email":"gu.collab@test.invalid"}', true);
  BEGIN
    PERFORM * FROM public.admin_users_status();
    INSERT INTO gu_resultats(test, ok, detail) VALUES ('Collaborateur : ne peut pas lire les statuts de connexion', false, 'accepté à tort');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO gu_resultats(test, ok, detail) VALUES ('Collaborateur : ne peut pas lire les statuts de connexion', true, 'refusé par la base');
  END;

  -- Import (simulation, rien n'est enregistré)
  PERFORM set_config('request.jwt.claims', '{"email":"gu.adm@test.invalid"}', true);
  _res := public.bulk_import_allowed_users('[
    {"line": 2, "email": "gu.m1@test.invalid", "first_name": "M", "last_name": "Un", "role": "manager", "team": ""},
    {"line": 3, "email": "gu.m2@test.invalid", "first_name": "M", "last_name": "Deux", "role": "manager", "team": "Product; Marketing"},
    {"line": 4, "email": "gu.c1@test.invalid", "first_name": "C", "last_name": "Un", "role": "collaborateur", "team": "Product; Marketing"},
    {"line": 5, "email": "gu.c2@test.invalid", "first_name": "C", "last_name": "Deux", "role": "collaborateur", "team": "product"}
  ]'::jsonb, true);
  INSERT INTO gu_resultats(test, ok, detail) VALUES ('Import : manager sans équipe refusé', (_res->'rows'->0->>'status') = 'refusée', _res->'rows'->0->>'reason');
  INSERT INTO gu_resultats(test, ok, detail) VALUES ('Import : manager avec 2 équipes accepté', (_res->'rows'->1->>'status') = 'valide', _res->'rows'->1->>'team');
  INSERT INTO gu_resultats(test, ok, detail) VALUES ('Import : collaborateur avec 2 équipes refusé', (_res->'rows'->2->>'status') = 'refusée', _res->'rows'->2->>'reason');
  INSERT INTO gu_resultats(test, ok, detail) VALUES ('Import : collaborateur avec 1 équipe accepté', (_res->'rows'->3->>'status') = 'valide', _res->'rows'->3->>'team');
  RESET ROLE;
END $$;

SELECT test, ok, detail FROM gu_resultats ORDER BY n;
ROLLBACK;
