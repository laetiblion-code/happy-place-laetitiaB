-- Délégation des actualités recalculée quand l'admin change l'autrice d'une actualité existante
-- (T29, 2026-11-04). Avant : la délégation était figée à la création, donc une actualité publiée
-- par Olivia sous son nom puis réattribuée à Julie n'affichait pas « via Olivia (admin) ».
-- Règle : si un admin change l'autrice, la délégation devient cet admin (ou rien si l'autrice
-- redevient l'admin lui-même). Sinon, la délégation reste inchangée. Elle n'est jamais saisie
-- par le navigateur.
CREATE OR REPLACE FUNCTION private.protect_news_delegation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  _moi text := lower(auth.jwt() ->> 'email');
BEGIN
  IF private.is_admin() THEN
    NEW.author_email := lower(coalesce(NEW.author_email, OLD.author_email));
    IF NEW.author_email IS DISTINCT FROM OLD.author_email THEN
      NEW.delegated_by_email := CASE WHEN NEW.author_email = _moi THEN NULL ELSE _moi END;
    ELSE
      NEW.delegated_by_email := OLD.delegated_by_email;
    END IF;
  ELSE
    NEW.author_email := OLD.author_email;
    NEW.delegated_by_email := OLD.delegated_by_email;
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$$;
