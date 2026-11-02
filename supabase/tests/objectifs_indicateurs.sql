-- ============================================================
-- Test des objectifs d'indicateurs (metrics.target, metrics.higher_is_better)
-- À coller dans Supabase > SQL Editor, puis Run, après la migration.
-- Transaction annulée à la fin (ROLLBACK). Attendu : toutes les lignes à « true ».
-- ============================================================
BEGIN;

CREATE TEMP TABLE oi_resultats (n serial, test text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON oi_resultats TO authenticated;
GRANT USAGE ON SEQUENCE oi_resultats_n_seq TO authenticated;

INSERT INTO oi_resultats(test, ok, detail)
SELECT 'Objectifs posés : placement 55, délai 28 (plus bas est mieux), NPS 75',
       count(*) = 3, count(*) || ' sur 3'
  FROM public.metrics
 WHERE (key = 'training_kpi' AND target = 55 AND higher_is_better)
    OR (key = 'turnover' AND target = 28 AND NOT higher_is_better)
    OR (key = 'nps' AND target = 75 AND higher_is_better);

INSERT INTO oi_resultats(test, ok, detail)
SELECT 'La vue expose objectif, sens et affichage sur l''accueil',
       count(*) = 3, string_agg(column_name, ', ')
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'metrics_with_trend'
   AND column_name IN ('target', 'higher_is_better', 'on_dashboard');

INSERT INTO oi_resultats(test, ok, detail)
SELECT 'La vue reste en security_invoker',
       coalesce('security_invoker=true' = ANY (reloptions), false), coalesce(array_to_string(reloptions, ', '), 'aucune option')
  FROM pg_class WHERE oid = 'public.metrics_with_trend'::regclass;

DO $$
DECLARE
  _id uuid; _n int;
BEGIN
  INSERT INTO public.allowed_users(email) VALUES ('oi.admin@test.invalid') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'admin');
  INSERT INTO public.allowed_users(email) VALUES ('oi.collab@test.invalid') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'collaborateur');

  SET LOCAL ROLE authenticated;

  PERFORM set_config('request.jwt.claims', '{"email":"oi.admin@test.invalid"}', true);
  UPDATE public.metrics SET target = 60 WHERE key = 'training_kpi';
  GET DIAGNOSTICS _n = ROW_COUNT;
  INSERT INTO oi_resultats(test, ok, detail) VALUES ('Admin : modifie un objectif', _n = 1, _n || ' ligne(s)');

  PERFORM set_config('request.jwt.claims', '{"email":"oi.collab@test.invalid"}', true);
  UPDATE public.metrics SET target = 10 WHERE key = 'training_kpi';
  GET DIAGNOSTICS _n = ROW_COUNT;
  INSERT INTO oi_resultats(test, ok, detail) VALUES ('Collaborateur : ne modifie pas un objectif', _n = 0, _n || ' ligne(s)');

  SELECT count(*) INTO _n FROM public.metrics_with_trend WHERE target IS NOT NULL;
  INSERT INTO oi_resultats(test, ok, detail) VALUES ('Collaborateur : lit les objectifs dans la vue', _n >= 3, _n || ' objectif(s)');

  RESET ROLE;
END $$;

SELECT test, ok, detail FROM oi_resultats ORDER BY n;
ROLLBACK;
