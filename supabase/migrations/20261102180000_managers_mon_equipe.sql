-- Managers de l'équipe de la personne connectée (T9, EP3 « Où en est ma demande ? »).
-- Un collaborateur ne peut pas lire manager_teams ni allowed_users des autres (RLS).
-- Cette fonction renvoie seulement le prénom et le nom des managers de SA propre équipe,
-- pour afficher « Envoyée à Kesha (manager Product) ». Aucune autre donnée n'est exposée (pas d'e-mail).
CREATE OR REPLACE FUNCTION public.managers_de_mon_equipe()
RETURNS TABLE (team text, prenom text, nom text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT mt.team,
         coalesce(nullif(btrim(m.first_name), ''), split_part(m.email, '@', 1)) AS prenom,
         btrim(concat_ws(' ', m.first_name, m.last_name)) AS nom
    FROM public.allowed_users moi
    JOIN public.manager_teams mt ON lower(btrim(mt.team)) = lower(btrim(moi.team))
    JOIN public.allowed_users m ON m.id = mt.allowed_user_id
    JOIN public.allowed_user_roles r ON r.allowed_user_id = m.id AND r.role = 'manager'
   WHERE moi.email = lower(auth.jwt() ->> 'email')
     AND private.is_allowed()
   ORDER BY 2;
$$;

REVOKE ALL ON FUNCTION public.managers_de_mon_equipe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.managers_de_mon_equipe() TO authenticated;
