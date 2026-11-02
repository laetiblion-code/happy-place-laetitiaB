-- ============================================================
-- Test de public.completer_ma_demande()
-- À coller dans Supabase > SQL Editor, puis Run, après la migration.
-- Transaction annulée à la fin (ROLLBACK). Attendu : toutes les lignes à « true ».
-- ============================================================
BEGIN;

CREATE TEMP TABLE cd_resultats (n serial, test text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON cd_resultats TO authenticated;
GRANT USAGE ON SEQUENCE cd_resultats_n_seq TO authenticated;

DO $$
DECLARE
  _id uuid; _s uuid; _s2 uuid; _st text; _c text; _n int;
BEGIN
  INSERT INTO public.teams(name) VALUES ('ZZ Equipe CD') ON CONFLICT DO NOTHING;
  INSERT INTO public.allowed_users(email, first_name, last_name, team) VALUES ('cd.collab@test.invalid', 'Gaston', 'Test', 'ZZ Equipe CD') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'collaborateur');
  INSERT INTO public.allowed_users(email, first_name, team) VALUES ('cd.autre@test.invalid', 'Autre', 'ZZ Equipe CD') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'collaborateur');

  -- Une demande refusée « à clarifier » et une refusée « doublon », écrites directement
  -- (au nom du collaborateur : le trigger set_submission_owner lit l'e-mail de la session).
  PERFORM set_config('request.jwt.claims', '{"email":"cd.collab@test.invalid"}', true);
  INSERT INTO public.submissions(author_name, team, content, status, submitted_by_email, visibility, rejection_category, rejection_note)
  VALUES ('Gaston Test', 'ZZ Equipe CD', 'Peut-on avoir un outil ?', 'refusée', 'cd.collab@test.invalid', 'privée', 'à clarifier', 'Lequel ?')
  RETURNING id INTO _s;
  INSERT INTO public.submissions(author_name, team, content, status, submitted_by_email, visibility, rejection_category, rejection_note)
  VALUES ('Gaston Test', 'ZZ Equipe CD', 'Autre demande', 'refusée', 'cd.collab@test.invalid', 'privée', 'doublon', 'Déjà demandé')
  RETURNING id INTO _s2;

  SET LOCAL ROLE authenticated;

  -- Un autre collaborateur ne peut pas compléter.
  PERFORM set_config('request.jwt.claims', '{"email":"cd.autre@test.invalid"}', true);
  BEGIN
    PERFORM public.completer_ma_demande(_s, 'Réponse pirate');
    INSERT INTO cd_resultats(test, ok, detail) VALUES ('Autre personne : refusé', false, 'accepté à tort');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO cd_resultats(test, ok, detail) VALUES ('Autre personne : refusé', true, SQLERRM);
  END;

  PERFORM set_config('request.jwt.claims', '{"email":"cd.collab@test.invalid"}', true);

  -- Réponse vide refusée.
  BEGIN
    PERFORM public.completer_ma_demande(_s, '   ');
    INSERT INTO cd_resultats(test, ok, detail) VALUES ('Réponse vide : refusée', false, 'acceptée à tort');
  EXCEPTION WHEN invalid_parameter_value THEN
    INSERT INTO cd_resultats(test, ok, detail) VALUES ('Réponse vide : refusée', true, SQLERRM);
  END;

  -- Refus « doublon » : pas de complément possible.
  BEGIN
    PERFORM public.completer_ma_demande(_s2, 'Je réponds quand même');
    INSERT INTO cd_resultats(test, ok, detail) VALUES ('Refus hors clarification : refusé', false, 'accepté à tort');
  EXCEPTION WHEN invalid_parameter_value THEN
    INSERT INTO cd_resultats(test, ok, detail) VALUES ('Refus hors clarification : refusé', true, SQLERRM);
  END;

  -- L'auteur complète : la demande repasse en attente avec sa réponse.
  PERFORM public.completer_ma_demande(_s, 'Un outil de ticketing pour 8 personnes');
  SELECT status::text, content INTO _st, _c FROM public.submissions WHERE id = _s;
  INSERT INTO cd_resultats(test, ok, detail) VALUES ('Auteur : la demande repasse en attente', _st = 'en attente', _st);
  INSERT INTO cd_resultats(test, ok, detail) VALUES ('Auteur : la réponse est ajoutée au texte', _c LIKE '%Réponse à la clarification : Un outil de ticketing pour 8 personnes', right(_c, 60));

  SELECT count(*) INTO _n FROM public.submission_status_history
   WHERE submission_id = _s AND old_status = 'refusée' AND new_status = 'en attente' AND changed_by_email = 'cd.collab@test.invalid';
  INSERT INTO cd_resultats(test, ok, detail) VALUES ('Historique : refusée → en attente par l''auteur', _n = 1, _n || ' ligne(s)');

  -- L'auteur ne peut toujours pas modifier sa demande directement.
  UPDATE public.submissions SET content = 'Modif directe' WHERE id = _s;
  GET DIAGNOSTICS _n = ROW_COUNT;
  INSERT INTO cd_resultats(test, ok, detail) VALUES ('Auteur : pas de modification directe', _n = 0, _n || ' ligne(s)');

  RESET ROLE;
END $$;

INSERT INTO cd_resultats(test, ok, detail)
SELECT 'anon ne peut pas exécuter la fonction', NOT has_function_privilege('anon', 'public.completer_ma_demande(uuid, text, text)', 'EXECUTE'), '';

SELECT test, ok, detail FROM cd_resultats ORDER BY n;
ROLLBACK;
