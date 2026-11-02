-- ============================================================
-- Test des indicateurs affichés sur l'accueil (metrics.on_dashboard)
-- À coller dans Supabase > SQL Editor, puis Run, après la migration.
-- Transaction annulée à la fin (ROLLBACK). Attendu : toutes les lignes à « true ».
-- ============================================================
BEGIN;

CREATE TEMP TABLE ia_resultats (n serial, test text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON ia_resultats TO authenticated;
GRANT USAGE ON SEQUENCE ia_resultats_n_seq TO authenticated;

INSERT INTO ia_resultats(test, ok, detail)
SELECT 'Au plus 4 indicateurs sur l''accueil au départ', count(*) <= 4, count(*) || ' indicateur(s)'
FROM public.metrics WHERE on_dashboard;

DO $$
DECLARE
  _id uuid; _n int; _cle text;
BEGIN
  -- Remplir l'accueil à 4 pour le test.
  UPDATE public.metrics SET on_dashboard = false;
  UPDATE public.metrics SET on_dashboard = true
   WHERE key IN (SELECT key FROM public.metrics ORDER BY key LIMIT 4);
  SELECT key INTO _cle FROM public.metrics WHERE NOT on_dashboard ORDER BY key LIMIT 1;

  INSERT INTO public.allowed_users(email) VALUES ('ia.admin@test.invalid') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'admin');
  INSERT INTO public.allowed_users(email) VALUES ('ia.manager@test.invalid') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'manager');

  SET LOCAL ROLE authenticated;

  -- Un 5e indicateur est refusé, même pour l'admin.
  PERFORM set_config('request.jwt.claims', '{"email":"ia.admin@test.invalid"}', true);
  BEGIN
    UPDATE public.metrics SET on_dashboard = true WHERE key = _cle;
    INSERT INTO ia_resultats(test, ok, detail) VALUES ('Admin : un 5e indicateur est refusé', false, 'accepté à tort');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO ia_resultats(test, ok, detail) VALUES ('Admin : un 5e indicateur est refusé', true, SQLERRM);
  END;

  -- Retirer un indicateur puis en ajouter un autre : accepté.
  UPDATE public.metrics SET on_dashboard = false
   WHERE key = (SELECT key FROM public.metrics WHERE on_dashboard ORDER BY key LIMIT 1);
  UPDATE public.metrics SET on_dashboard = true WHERE key = _cle;
  SELECT count(*) INTO _n FROM public.metrics WHERE on_dashboard;
  INSERT INTO ia_resultats(test, ok, detail) VALUES ('Admin : échange d''un indicateur accepté', _n = 4, _n || ' indicateur(s)');

  -- Mettre à jour la valeur d'un indicateur affiché reste possible.
  UPDATE public.metrics SET value = value WHERE key = _cle;
  INSERT INTO ia_resultats(test, ok, detail) VALUES ('Admin : mise à jour d''un indicateur affiché acceptée', true, '');

  -- Un manager ne change pas l'affichage.
  PERFORM set_config('request.jwt.claims', '{"email":"ia.manager@test.invalid"}', true);
  UPDATE public.metrics SET on_dashboard = false WHERE key = _cle;
  GET DIAGNOSTICS _n = ROW_COUNT;
  INSERT INTO ia_resultats(test, ok, detail) VALUES ('Manager : ne peut pas modifier l''affichage', _n = 0, _n || ' ligne(s) modifiée(s)');

  -- Tout le monde lit les mêmes indicateurs.
  SELECT count(*) INTO _n FROM public.metrics WHERE on_dashboard;
  INSERT INTO ia_resultats(test, ok, detail) VALUES ('Manager : lit les 4 indicateurs de l''accueil', _n = 4, _n || ' indicateur(s)');

  RESET ROLE;
END $$;

SELECT test, ok, detail FROM ia_resultats ORDER BY n;
ROLLBACK;
