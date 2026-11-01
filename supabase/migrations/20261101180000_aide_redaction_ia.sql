-- ============================================================
-- Aide à la rédaction des actualités par IA (T8, EP10)
-- Suivi des appels et plafond quotidien (CA10.6), sans clé service_role :
-- l'Edge Function appelle public.reserver_appel_ia avec la session de la personne.
--   - réservé aux managers et aux admins ;
--   - 10 générations par personne et par jour ;
--   - 40 générations par jour pour tout le cabinet (protège les crédits Make et OpenAI).
-- ============================================================
BEGIN;

CREATE TABLE public.ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('lien', 'pdf', 'ameliorer')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_requests_jour ON public.ai_requests (created_at);
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ai_requests TO authenticated;
GRANT ALL ON public.ai_requests TO service_role;
CREATE POLICY "Admins read ai requests" ON public.ai_requests
  FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY "Users read own ai requests" ON public.ai_requests
  FOR SELECT TO authenticated USING (user_email = lower(auth.jwt() ->> 'email'));

CREATE OR REPLACE FUNCTION public.reserver_appel_ia(_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _email text := lower(auth.jwt() ->> 'email');
  _mine int; _all int;
BEGIN
  IF private.current_app_role() NOT IN ('manager'::public.app_role, 'admin'::public.app_role)
     OR private.current_app_role() IS NULL THEN
    RAISE EXCEPTION 'Réservé aux managers et aux admins.' USING ERRCODE = '42501';
  END IF;
  IF _kind NOT IN ('lien', 'pdf', 'ameliorer') THEN
    RAISE EXCEPTION 'Type de demande inconnu.';
  END IF;
  -- Verrou court : deux appels simultanés ne dépassent pas le plafond
  PERFORM pg_advisory_xact_lock(hashtext('ai_requests'));
  SELECT count(*) FILTER (WHERE user_email = _email), count(*)
    INTO _mine, _all
    FROM public.ai_requests WHERE created_at >= date_trunc('day', now());
  IF _mine >= 10 THEN
    RAISE EXCEPTION 'Tu as atteint la limite de 10 propositions de l''IA pour aujourd''hui.' USING ERRCODE = 'P0429';
  END IF;
  IF _all >= 40 THEN
    RAISE EXCEPTION 'La limite quotidienne du cabinet est atteinte. Réessaie demain.' USING ERRCODE = 'P0429';
  END IF;
  INSERT INTO public.ai_requests(user_email, kind) VALUES (_email, _kind);
  RETURN jsonb_build_object('restant', 9 - _mine);
END
$$;
REVOKE ALL ON FUNCTION public.reserver_appel_ia(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserver_appel_ia(text) TO authenticated;

COMMIT;
