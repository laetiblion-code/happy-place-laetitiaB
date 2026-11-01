-- ============================================================
-- Demandes des managers et des admins validées à l'envoi (EP1, EP3).
-- Décision du 2026-11-01 : on ne traite pas ses propres demandes ; celles
-- d'un manager ou d'un admin passent directement au statut « validée »
-- et apparaissent dans « Mes demandes ».
-- ============================================================
BEGIN;

-- 1. Validation à l'envoi. Le nom commence par « a » : PostgreSQL lance les
--    triggers BEFORE par ordre alphabétique, celui-ci passe donc avant
--    set_revalidate_at, qui pose l'échéance de revalidation annuelle.
CREATE OR REPLACE FUNCTION private.auto_validate_staff_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF private.current_app_role() IN ('manager'::public.app_role, 'admin'::public.app_role) THEN
    NEW.status := 'validée'::public.submission_status;
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION private.auto_validate_staff_submission() FROM PUBLIC, anon;

CREATE TRIGGER auto_validate_staff_submission
  BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION private.auto_validate_staff_submission();

-- 2. Règle d'envoi : un collaborateur crée une demande « en attente »,
--    un manager ou un admin une demande « validée ».
DROP POLICY IF EXISTS "Allowed create pending submissions" ON public.submissions;
CREATE POLICY "Allowed create pending submissions" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_allowed() AND (
      status = 'en attente'::public.submission_status
      OR (status = 'validée'::public.submission_status
          AND private.current_app_role() IN ('manager'::public.app_role, 'admin'::public.app_role))
    )
  );

-- 3. Reprise des données : les demandes encore en attente envoyées par un
--    manager ou un admin passent en « validée ».
UPDATE public.submissions s
   SET status = 'validée'
 WHERE s.status = 'en attente'
   AND EXISTS (
     SELECT 1 FROM public.allowed_users au
     JOIN public.allowed_user_roles aur ON aur.allowed_user_id = au.id
     WHERE au.email = s.submitted_by_email
       AND aur.role IN ('manager'::public.app_role, 'admin'::public.app_role)
   );

COMMIT;
