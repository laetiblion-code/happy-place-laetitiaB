-- Indicateurs affichés sur l'accueil (T9, décision du 2026-11-02).
-- L'admin choisit au plus 4 indicateurs ; tout le monde voit les mêmes.
-- Remplace les clés codées en dur dans l'accueil.

ALTER TABLE public.metrics
  ADD COLUMN IF NOT EXISTS on_dashboard boolean NOT NULL DEFAULT false;

-- Les 4 indicateurs retenus le 2026-10-30 : taux de placement, délai moyen,
-- NPS, missions actives.
UPDATE public.metrics
   SET on_dashboard = true
 WHERE key IN ('training_kpi', 'turnover', 'nps', 'active_users');

CREATE OR REPLACE FUNCTION private.check_dashboard_metrics_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.on_dashboard AND (TG_OP = 'INSERT' OR NOT OLD.on_dashboard) THEN
    -- Sérialise les changements concurrents.
    PERFORM pg_advisory_xact_lock(hashtext('metrics_on_dashboard'));
    IF (SELECT count(*) FROM public.metrics m
         WHERE m.on_dashboard AND m.key <> NEW.key) >= 4 THEN
      RAISE EXCEPTION 'L''accueil affiche au plus 4 indicateurs. Retire d''abord un indicateur de l''accueil.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS check_dashboard_metrics_limit ON public.metrics;
CREATE TRIGGER check_dashboard_metrics_limit
  BEFORE INSERT OR UPDATE OF on_dashboard ON public.metrics
  FOR EACH ROW EXECUTE FUNCTION private.check_dashboard_metrics_limit();
