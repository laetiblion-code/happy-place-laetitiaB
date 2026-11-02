-- Objectifs des indicateurs clés (T9, maquettes du jeu 2 et décision du 2026-10-30).
-- Chaque indicateur peut avoir un objectif et un sens (plus haut ou plus bas est mieux).
-- Modifiables par l'admin dans la gestion des indicateurs, sans code.

ALTER TABLE public.metrics
  ADD COLUMN IF NOT EXISTS target numeric,
  ADD COLUMN IF NOT EXISTS higher_is_better boolean NOT NULL DEFAULT true;

-- Objectifs de fin de semestre donnés le 2026-10-30.
UPDATE public.metrics SET target = 55 WHERE key = 'training_kpi';                          -- Taux de placement, 55 %
UPDATE public.metrics SET target = 28, higher_is_better = false WHERE key = 'turnover';     -- Délai moyen, 28 jours, plus bas est mieux
UPDATE public.metrics SET target = 75 WHERE key = 'nps';                                   -- NPS candidats, 75
-- Missions actives : sans objectif.

-- La vue expose les nouvelles colonnes (ajoutées en fin de liste) ; elle reste en security_invoker.
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
       m.higher_is_better
  FROM public.metrics m
  LEFT JOIN LATERAL (
    SELECT h.value
      FROM public.metrics_history h
     WHERE h.metric_key = m.key
     ORDER BY h.recorded_at DESC
    OFFSET 1
     LIMIT 1
  ) p ON true;
