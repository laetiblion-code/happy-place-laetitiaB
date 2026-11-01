-- ============================================================
-- T26 : « a du contenu » compte aussi les décisions prises sur des demandes
-- (historique des statuts), pour protéger les managers de démonstration
-- qui ont validé ou refusé des demandes sans jamais se connecter.
-- ============================================================
BEGIN;

DROP FUNCTION IF EXISTS public.admin_users_status();
CREATE FUNCTION public.admin_users_status()
RETURNS TABLE (email text, a_un_compte boolean, mot_de_passe_cree boolean, derniere_connexion timestamptz, a_du_contenu boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Réservé aux admins.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT au.email,
         u.id IS NOT NULL,
         coalesce(u.encrypted_password, '') <> '',
         u.last_sign_in_at,
         EXISTS (SELECT 1 FROM public.submissions s WHERE s.submitted_by_email = au.email)
           OR EXISTS (SELECT 1 FROM public.news n WHERE n.author_email = au.email)
           OR EXISTS (SELECT 1 FROM public.submission_status_history h WHERE h.changed_by_email = au.email)
  FROM public.allowed_users au
  LEFT JOIN auth.users u ON lower(u.email) = au.email;
END
$$;
REVOKE ALL ON FUNCTION public.admin_users_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_users_status() TO authenticated;

COMMIT;
