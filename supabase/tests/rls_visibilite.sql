-- ============================================================
-- Test des règles de visibilité des demandes (RLS)
-- À coller dans Supabase > SQL Editor, puis Run.
-- Tout se passe dans une transaction annulée à la fin (ROLLBACK) :
-- aucune donnée n'est conservée. Résultat attendu : toutes les lignes à « true ».
-- ============================================================
BEGIN;

CREATE TEMP TABLE rls_resultats (n serial, test text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON rls_resultats TO authenticated;
GRANT USAGE ON SEQUENCE rls_resultats_n_seq TO authenticated;

DO $$
DECLARE
  _a text := 'ZZ RLS équipe avec manager';
  _b text := 'ZZ RLS équipe sans manager';
  _id uuid; _m uuid;
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid;
  _ids uuid[];
  _n int; _ok boolean;

BEGIN
  -- Jeu de test
  INSERT INTO public.teams(name) VALUES (_a), (_b);
  INSERT INTO public.allowed_users(email, team) VALUES ('rls.c1@test.invalid', _a) RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'collaborateur');
  INSERT INTO public.allowed_users(email, team) VALUES ('rls.c2@test.invalid', _a) RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'collaborateur');
  INSERT INTO public.allowed_users(email, team) VALUES ('rls.cb@test.invalid', _b) RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'collaborateur');
  INSERT INTO public.allowed_users(email) VALUES ('rls.mgr@test.invalid') RETURNING id INTO _m;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_m, 'manager');
  INSERT INTO public.manager_teams(allowed_user_id, team) VALUES (_m, _a);
  INSERT INTO public.allowed_users(email) VALUES ('rls.adm@test.invalid') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'admin');

  PERFORM set_config('request.jwt.claims', '{"email":"rls.c1@test.invalid"}', true);
  INSERT INTO public.submissions(author_name, team, content, visibility) VALUES ('C1', _a, 'RLS S1 privée en attente', 'privée') RETURNING id INTO s1;
  INSERT INTO public.submissions(author_name, team, content, visibility) VALUES ('C1', _a, 'RLS S2 équipe en attente', 'équipe') RETURNING id INTO s2;
  INSERT INTO public.submissions(author_name, team, content, visibility) VALUES ('C1', _a, 'RLS S3 équipe validée', 'équipe') RETURNING id INTO s3;
  INSERT INTO public.submissions(author_name, team, content, visibility) VALUES ('C1', _a, 'RLS S4 entreprise validée', 'entreprise') RETURNING id INTO s4;
  PERFORM set_config('request.jwt.claims', '{"email":"rls.cb@test.invalid"}', true);
  INSERT INTO public.submissions(author_name, team, content, visibility) VALUES ('CB', _b, 'RLS S5 privée équipe sans manager', 'privée') RETURNING id INTO s5;
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.submissions SET status = 'validée' WHERE id IN (s3, s4);
  _ids := ARRAY[s1, s2, s3, s4, s5];

  -- Lecture, rôle par rôle
  PERFORM set_config('request.jwt.claims', '{"email":"rls.c1@test.invalid"}', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO _n FROM public.submissions WHERE id = ANY(_ids);
  INSERT INTO rls_resultats(test, ok, detail) VALUES ('Auteur : voit ses 4 demandes, quelle que soit la visibilité', _n = 4, _n || ' vue(s)');

  PERFORM set_config('request.jwt.claims', '{"email":"rls.c2@test.invalid"}', true);
  SELECT count(*) INTO _n FROM public.submissions WHERE id IN (s3, s4);
  SELECT count(*) = 0 INTO _ok FROM public.submissions WHERE id IN (s1, s2, s5);
  INSERT INTO rls_resultats(test, ok, detail) VALUES ('Collègue de la même équipe : voit Équipe et Entreprise validées, rien en attente ni de privé', _n = 2 AND _ok, _n || ' vue(s)');

  PERFORM set_config('request.jwt.claims', '{"email":"rls.cb@test.invalid"}', true);
  SELECT count(*) INTO _n FROM public.submissions WHERE id IN (s1, s2, s3, s4);
  INSERT INTO rls_resultats(test, ok, detail) VALUES ('Collaborateur d''une autre équipe : voit seulement l''Entreprise validée', _n = 1, _n || ' vue(s)');

  PERFORM set_config('request.jwt.claims', '{"email":"rls.mgr@test.invalid"}', true);
  SELECT count(*) INTO _n FROM public.submissions WHERE id IN (s1, s2, s3, s4);
  SELECT count(*) = 0 INTO _ok FROM public.submissions WHERE id = s5;
  INSERT INTO rls_resultats(test, ok, detail) VALUES ('Manager : voit toutes les demandes de son équipe, même privées, pas celles des autres', _n = 4 AND _ok, _n || ' vue(s)');

  PERFORM set_config('request.jwt.claims', '{"email":"rls.adm@test.invalid"}', true);
  SELECT count(*) = 0 INTO _ok FROM public.submissions WHERE id = s1;
  INSERT INTO rls_resultats(test, ok, detail) VALUES ('Admin : ne voit pas une demande privée d''une équipe qui a un manager', _ok, '');
  SELECT count(*) INTO _n FROM public.submissions WHERE id IN (s2, s3, s4, s5);
  INSERT INTO rls_resultats(test, ok, detail) VALUES ('Admin : voit les demandes non privées et les privées des équipes sans manager', _n = 4, _n || ' vue(s)');
  UPDATE public.submissions SET rejection_note = rejection_note WHERE id = s1;
  GET DIAGNOSTICS _n = ROW_COUNT;
  INSERT INTO rls_resultats(test, ok, detail) VALUES ('Admin : ne peut pas modifier cette demande privée', _n = 0, _n || ' ligne(s) modifiée(s)');
  UPDATE public.submissions SET status = 'validée' WHERE id = s5;
  GET DIAGNOSTICS _n = ROW_COUNT;
  INSERT INTO rls_resultats(test, ok, detail) VALUES ('Admin : traite la demande privée d''une équipe sans manager', _n = 1, _n || ' ligne(s) modifiée(s)');

  PERFORM set_config('request.jwt.claims', '{"email":"rls.mgr@test.invalid"}', true);
  BEGIN
    UPDATE public.submissions SET visibility = 'entreprise', status = 'validée' WHERE id = s2;
    INSERT INTO rls_resultats(test, ok, detail) VALUES ('Manager : ne peut pas changer la visibilité', false, 'accepté à tort');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO rls_resultats(test, ok, detail) VALUES ('Manager : ne peut pas changer la visibilité', true, 'refusé par la base');
  END;

  PERFORM set_config('request.jwt.claims', '{"email":"inconnu@test.invalid"}', true);
  SELECT count(*) INTO _n FROM public.submissions;
  INSERT INTO rls_resultats(test, ok, detail) VALUES ('Compte hors liste blanche : aucune demande', _n = 0, _n || ' vue(s)');
  SELECT count(*) INTO _n FROM public.teams;
  INSERT INTO rls_resultats(test, ok, detail) VALUES ('Compte hors liste blanche : aucune équipe (écart 2)', _n = 0, _n || ' vue(s)');

  PERFORM set_config('request.jwt.claims', '{"email":"rls.c1@test.invalid"}', true);
  SELECT count(*) INTO _n FROM public.teams;
  INSERT INTO rls_resultats(test, ok, detail) VALUES ('Collaborateur de la liste blanche : lit la liste des équipes', _n > 0, _n || ' équipe(s)');
  RESET ROLE;
END $$;

SELECT test, ok, detail FROM rls_resultats ORDER BY n;
ROLLBACK;
