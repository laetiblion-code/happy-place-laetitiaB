-- ============================================================
-- Catégories des demandes (EP3). Décisions du 2026-10-30 et du 2026-10-31.
-- 4 catégories : Question, Idée, Problème, Amélioration de Happy Place.
-- Les demandes existantes restent sans catégorie ; le formulaire rend le
-- choix obligatoire pour les nouvelles. Le manager ne peut pas la changer.
-- ============================================================
BEGIN;

CREATE TYPE public.submission_category AS ENUM ('question', 'idée', 'problème', 'amélioration de Happy Place');

ALTER TABLE public.submissions
  ADD COLUMN category public.submission_category;

-- Le manager traite la demande mais ne change ni sa visibilité ni sa catégorie
CREATE OR REPLACE FUNCTION private.enforce_submission_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $function$
BEGIN
  IF private.current_app_role() = 'manager'::public.app_role THEN
    IF NEW.author_name IS DISTINCT FROM OLD.author_name
       OR NEW.team IS DISTINCT FROM OLD.team
       OR NEW.content IS DISTINCT FROM OLD.content
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.visibility IS DISTINCT FROM OLD.visibility
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.status NOT IN ('validée'::public.submission_status, 'refusée'::public.submission_status)
       OR OLD.status <> 'en attente'::public.submission_status
       OR NOT private.can_review_team(OLD.team) THEN
      RAISE EXCEPTION 'Un manager peut uniquement valider ou refuser une soumission en attente de ses équipes';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

COMMIT;
