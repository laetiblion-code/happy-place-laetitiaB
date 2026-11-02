-- ============================================================
-- Test des noms affichés à la place des e-mails (public.noms_affiches)
-- À coller dans Supabase > SQL Editor, puis Run.
-- Transaction annulée à la fin (ROLLBACK). Attendu : toutes les lignes à « true ».
-- ============================================================
BEGIN;

CREATE TEMP TABLE na_resultats (n serial, test text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON na_resultats TO authenticated;
GRANT USAGE ON SEQUENCE na_resultats_n_seq TO authenticated;

DO $$
DECLARE
  _id uuid; _n int; _liste text[];
BEGIN
  -- Utilisateur avec prénom et nom
  INSERT INTO public.allowed_users(email, first_name, last_name) VALUES ('na.nina@test.invalid', 'Nina', 'Petit') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'collaborateur');
  -- Utilisateur sans prénom ni nom
  INSERT INTO public.allowed_users(email) VALUES ('na.sansnom@test.invalid') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'collaborateur');
  -- Manager qui consulte
  INSERT INTO public.allowed_users(email, first_name, last_name) VALUES ('na.manager@test.invalid', 'Marc', 'Dupont') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'manager');

  SET LOCAL ROLE authenticated;

  -- Utilisateur whitelisté : « Prénom Nom » (adresse saisie en majuscules)
  PERFORM set_config('request.jwt.claims', '{"email":"na.manager@test.invalid"}', true);
  SELECT count(*) INTO _n FROM public.noms_affiches(ARRAY['NA.Nina@test.invalid']) s
   WHERE s.email = 'na.nina@test.invalid' AND s.nom = 'Nina Petit';
  INSERT INTO na_resultats(test, ok, detail) VALUES ('Utilisateur whitelisté : « Prénom Nom » renvoyé', _n = 1, _n || ' ligne(s)');

  -- Aucun prénom ni nom : aucune ligne (l'appelant affiche alors l'e-mail)
  SELECT count(*) INTO _n FROM public.noms_affiches(ARRAY['na.sansnom@test.invalid']) s;
  INSERT INTO na_resultats(test, ok, detail) VALUES ('Sans prénom ni nom : aucune ligne renvoyée', _n = 0, _n || ' ligne(s)');

  -- Adresse absente de la liste blanche : aucune ligne
  PERFORM set_config('request.jwt.claims', '{"email":"externe.inconnu@test.invalid"}', true);
  SELECT count(*) INTO _n FROM public.noms_affiches(ARRAY['na.nina@test.invalid']) s;
  INSERT INTO na_resultats(test, ok, detail) VALUES ('Compte hors liste blanche : aucune ligne renvoyée', _n = 0, _n || ' ligne(s)');

  -- Plus de 200 adresses : refusé
  SELECT array_agg('x' || g || '@test.invalid') INTO _liste FROM generate_series(1, 201) g;
  PERFORM set_config('request.jwt.claims', '{"email":"na.manager@test.invalid"}', true);
  BEGIN
    PERFORM * FROM public.noms_affiches(_liste);
    INSERT INTO na_resultats(test, ok, detail) VALUES ('201 adresses : refusé', false, 'accepté à tort');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO na_resultats(test, ok, detail) VALUES ('201 adresses : refusé', true, SQLERRM);
  END;

  RESET ROLE;
END $$;

-- Droits d'exécution (indépendants de l'appelant)
INSERT INTO na_resultats(test, ok, detail)
SELECT 'anon ne peut pas exécuter la fonction', NOT has_function_privilege('anon', 'public.noms_affiches(text[])', 'EXECUTE'), '';
INSERT INTO na_resultats(test, ok, detail)
SELECT 'authenticated peut exécuter la fonction', has_function_privilege('authenticated', 'public.noms_affiches(text[])', 'EXECUTE'), '';

SELECT test, ok, detail FROM na_resultats ORDER BY n;
ROLLBACK;
