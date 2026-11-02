-- Ordre des indicateurs sur l'accueil et objectif des missions actives (T9, décisions du 2026-11-02).
-- L'admin choisit la position de chaque indicateur affiché (1 à 4) dans la gestion des indicateurs.

ALTER TABLE public.metrics
  ADD COLUMN IF NOT EXISTS dashboard_position smallint;

ALTER TABLE public.metrics
  DROP CONSTRAINT IF EXISTS metrics_dashboard_position_range;
ALTER TABLE public.metrics
  ADD CONSTRAINT metrics_dashboard_position_range
  CHECK (dashboard_position IS NULL OR dashboard_position BETWEEN 1 AND 4);

-- Ordre des maquettes : taux de placement, délai moyen, NPS, missions actives en dernier.
UPDATE public.metrics SET dashboard_position = 1 WHERE key = 'training_kpi';
UPDATE public.metrics SET dashboard_position = 2 WHERE key = 'turnover';
UPDATE public.metrics SET dashboard_position = 3 WHERE key = 'nps';
UPDATE public.metrics SET dashboard_position = 4 WHERE key = 'active_users';

-- Missions actives : objectif de 50, impact direct sur le chiffre d'affaires.
UPDATE public.metrics SET target = 50, higher_is_better = true WHERE key = 'active_users';

-- La vue expose la position (ajoutée en fin de liste), toujours en security_invoker.
CREATE OR REPLACE VIEW public.metrics_with_trend
WITH (security_invoker = true) AS
SELECT m.key,
       m.label,
       m.value,
       m.unit,
       m.updated_at,
       p.value AS previous_value,
       CASE
         WHEN p.value IS NULL OR p.value = m.value THEN 'stable'::text
         WHEN m.value > p.value THEN 'hausse'::text
         ELSE 'baisse'::text
       END AS trend,
       CASE WHEN p.value IS NULL THEN NULL::numeric ELSE m.value - p.value END AS delta,
       m.on_dashboard,
       m.target,
       m.higher_is_better,
       m.dashboard_position
  FROM public.metrics m
  LEFT JOIN LATERAL (
    SELECT h.value
      FROM public.metrics_history h
     WHERE h.metric_key = m.key
     ORDER BY h.recorded_at DESC
    OFFSET 1
     LIMIT 1
  ) p ON true;
