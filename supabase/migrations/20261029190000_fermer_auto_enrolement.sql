-- Fermeture de l'auto-enrôlement.
-- La connexion se fait désormais par lien magique, et les accès sont accordés
-- uniquement par un admin via la liste blanche (allowed_users, allowed_user_roles).
-- public.choisir_mon_role permettait à tout compte connecté de s'attribuer lui-même
-- un rôle (y compris admin) : on retire le droit d'exécution aux utilisateurs
-- authentifiés pour que plus personne ne puisse l'appeler depuis l'app ou l'API.
REVOKE EXECUTE ON FUNCTION public.choisir_mon_role(public.app_role, text, text, text) FROM authenticated;
