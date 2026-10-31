-- ============================================================
-- Visibilité des demandes sur 3 niveaux (EP5) et lecture des équipes
-- réservée à la liste blanche. Décisions du 2026-10-30 et du 2026-10-31.
--
-- Qui voit une demande :
--   - son auteur, toujours ;
--   - le manager de l'équipe, toujours (c'est lui qui la traite) ;
--   - l'admin, sauf si elle est Privée dans une équipe qui a un manager ;
--   - les collègues, seulement une fois validée :
--       Équipe     -> les membres de la même équipe,
--       Entreprise -> toutes les personnes de la liste blanche.
-- ============================================================
BEGIN;

-- 1. Type et colonne
CREATE TYPE public.submission_visibility AS ENUM ('privée', 'équipe', 'entreprise');

ALTER TABLE public.submissions
  ADD COLUMN visibility public.submission_visibility NOT NULL DEFAULT 'privée';

-- Reprise des données : les demandes validées étaient visibles de tous,
-- elles passent en Entreprise ; les autres restent Privées.
UPDATE public.submissions SET visibility = 'entreprise' WHERE status = 'validée';

-- 2. Fonctions utilitaires
CREATE OR REPLACE FUNCTION private.team_has_manager(_team text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.manager_teams mt
    JOIN public.allowed_user_roles aur ON aur.allowed_user_id = mt.allowed_user_id
    WHERE aur.role = 'manager'::public.app_role
      AND lower(btrim(mt.team)) = lower(btrim(_team))
  )
$$;

CREATE OR REPLACE FUNCTION private.my_team()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT au.team FROM public.allowed_users au
  WHERE au.email = lower(auth.jwt() ->> 'email')
  LIMIT 1
$$;

-- L'admin peut-il voir ou traiter cette demande ?
CREATE OR REPLACE FUNCTION private.admin_can_see(_team text, _visibility public.submission_visibility)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT private.is_admin()
     AND (_visibility <> 'privée'::public.submission_visibility OR NOT private.team_has_manager(_team))
$$;

REVOKE ALL ON FUNCTION private.team_has_manager(text), private.my_team(),
  private.admin_can_see(text, public.submission_visibility) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.team_has_manager(text), private.my_team(),
  private.admin_can_see(text, public.submission_visibility) TO authenticated;

-- 3. Lecture des demandes
DROP POLICY IF EXISTS "Allowed read submissions" ON public.submissions;
CREATE POLICY "Allowed read submissions" ON public.submissions
  FOR SELECT TO authenticated
  USING (
    private.is_allowed() AND (
      submitted_by_email = lower(auth.jwt() ->> 'email')
      OR (private.current_app_role() = 'manager'::public.app_role AND private.can_review_team(team))
      OR private.admin_can_see(team, visibility)
      OR (status = 'validée'::public.submission_status AND (
            visibility = 'entreprise'::public.submission_visibility
         OR (visibility = 'équipe'::public.submission_visibility
             AND lower(btrim(team)) = lower(btrim(coalesce(private.my_team(), ''))))
      ))
    )
  );

-- 4. Traitement par l'admin : plus de droit sur les demandes privées
--    des équipes qui ont un manager.
DROP POLICY IF EXISTS "Admins manage submissions" ON public.submissions;
CREATE POLICY "Admins manage submissions" ON public.submissions
  FOR ALL TO authenticated
  USING (private.admin_can_see(team, visibility))
  WITH CHECK (private.admin_can_see(team, visibility));

-- 5. Le manager traite la demande mais ne change pas sa visibilité
CREATE OR REPLACE FUNCTION private.enforce_submission_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $function$
BEGIN
  IF private.current_app_role() = 'manager'::public.app_role THEN
    IF NEW.author_name IS DISTINCT FROM OLD.author_name
       OR NEW.team IS DISTINCT FROM OLD.team
       OR NEW.content IS DISTINCT FROM OLD.content
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.visibility IS DISTINCT FROM OLD.visibility
       OR NEW.status NOT IN ('validée'::public.submission_status, 'refusée'::public.submission_status)
       OR OLD.status <> 'en attente'::public.submission_status
       OR NOT private.can_review_team(OLD.team) THEN
      RAISE EXCEPTION 'Un manager peut uniquement valider ou refuser une soumission en attente de ses équipes';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

-- 6. Pièces jointes : l'admin suit la même règle que pour la demande
DROP POLICY IF EXISTS "Reviewers and owner read submission PDF" ON storage.objects;
CREATE POLICY "Reviewers and owner read submission PDF" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'submission-attachments' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.attachment_path = objects.name
          AND ((private.current_app_role() = 'manager'::public.app_role AND private.can_review_team(s.team))
               OR private.admin_can_see(s.team, s.visibility))
      )
    )
  );

-- 7. Équipes : lecture réservée à la liste blanche
--    (la règle « Allowed read teams » existe déjà ; on retire la règle ouverte
--     héritée de l'écran de choix du rôle, supprimé le 2026-10-29)
DROP POLICY IF EXISTS "Authenticated read teams" ON public.teams;

COMMIT;
