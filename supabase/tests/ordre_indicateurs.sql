-- ============================================================
-- Test de l'ordre des indicateurs (metrics.dashboard_position) et de l'objectif des missions actives
-- À coller dans Supabase > SQL Editor, puis Run, après la migration.
-- Transaction annulée à la fin (ROLLBACK). Attendu : toutes les lignes à « true ».
-- ============================================================
BEGIN;

CREATE TEMP TABLE oo_resultats (n serial, test text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON oo_resultats TO authenticated;
GRANT USAGE ON SEQUENCE oo_resultats_n_seq TO authenticated;

INSERT INTO oo_resultats(test, ok, detail)
SELECT 'Ordre : placement 1, délai 2, NPS 3, missions 4', count(*) = 4, count(*) || ' sur 4'
  FROM public.metrics
 WHERE (key, dashboard_position) IN (('training_kpi', 1), ('turnover', 2), ('nps', 3), ('active_users', 4));

INSERT INTO oo_resultats(test, ok, detail)
SELECT 'Missions actives : objectif 50, plus haut est mieux', count(*) = 1, count(*) || ' ligne(s)'
  FROM public.metrics WHERE key = 'active_users' AND target = 50 AND higher_is_better;

INSERT INTO oo_resultats(test, ok, detail)
SELECT 'La vue expose la position et reste en security_invoker',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'metrics_with_trend'
                  AND column_name = 'dashboard_position')
       AND coalesce('security_invoker=true' = ANY (reloptions), false), ''
  FROM pg_class WHERE oid = 'public.metrics_with_trend'::regclass;

DO $$
BEGIN
  BEGIN
    UPDATE public.metrics SET dashboard_position = 5 WHERE key = 'nps';
    INSERT INTO oo_resultats(test, ok, detail) VALUES ('Position 5 refusée', false, 'acceptée à tort');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO oo_resultats(test, ok, detail) VALUES ('Position 5 refusée', true, SQLERRM);
  END;
END $$;

SELECT test, ok, detail FROM oo_resultats ORDER BY n;
ROLLBACK;
