-- Actualités (T9, décisions du 2026-10-30 et du 2026-10-31, EP14 minimal) :
-- 1. Publication au nom d'un manager : l'admin choisit l'autrice (author_email) ; la base note
--    elle-même qui a rédigé (delegated_by_email), pour afficher « Kesha, via Olivia (admin) ».
--    La colonne n'est jamais saisie par le navigateur : le trigger l'écrase toujours.
-- 2. Date de dernière modification (updated_at) pour « Dernière modif il y a … ».
-- 3. Un manager modifie ou supprime ses propres actualités, brouillons ET publiées
--    (décision du 2026-10-30 : « ne modifie ou ne supprime que ses propres actus »).

ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS delegated_by_email text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.news SET updated_at = created_at WHERE updated_at > created_at;

CREATE OR REPLACE FUNCTION private.set_news_author_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _moi text := lower(auth.jwt() ->> 'email');
BEGIN
  IF NOT private.is_admin() OR NEW.author_email IS NULL THEN
    NEW.author_email := _moi;
  ELSE
    NEW.author_email := lower(NEW.author_email);
  END IF;
  -- Délégation : seulement un admin qui publie pour quelqu'un d'autre.
  IF private.is_admin() AND NEW.author_email IS DISTINCT FROM _moi THEN
    NEW.delegated_by_email := _moi;
  ELSE
    NEW.delegated_by_email := NULL;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION private.protect_news_delegation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Personne ne réécrit la délégation ni l'autrice après coup ; updated_at suit chaque modification.
  NEW.delegated_by_email := OLD.delegated_by_email;
  IF NOT private.is_admin() THEN
    NEW.author_email := OLD.author_email;
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS protect_news_delegation ON public.news;
CREATE TRIGGER protect_news_delegation
  BEFORE UPDATE ON public.news
  FOR EACH ROW EXECUTE FUNCTION private.protect_news_delegation();

-- Manager : ses propres actualités, brouillons et publiées.
DROP POLICY IF EXISTS "Manager update own draft news" ON public.news;
DROP POLICY IF EXISTS "Manager update own news" ON public.news;
CREATE POLICY "Manager update own news" ON public.news
  FOR UPDATE TO authenticated
  USING (private.current_app_role() = 'manager'::public.app_role
         AND author_email = lower(auth.jwt() ->> 'email'))
  WITH CHECK (private.current_app_role() = 'manager'::public.app_role
              AND status = ANY (ARRAY['brouillon'::public.news_status, 'publiée'::public.news_status])
              AND author_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Manager delete own draft news" ON public.news;
DROP POLICY IF EXISTS "Manager delete own news" ON public.news;
CREATE POLICY "Manager delete own news" ON public.news
  FOR DELETE TO authenticated
  USING (private.current_app_role() = 'manager'::public.app_role
         AND author_email = lower(auth.jwt() ->> 'email'));
