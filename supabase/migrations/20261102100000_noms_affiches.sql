-- Noms affichés à la place des e-mails (bandeau de départ, actualités, brouillons).
-- La RLS de allowed_users ne laisse lire que sa propre ligne : cette fonction renvoie
-- uniquement « prénom nom » pour les adresses demandées, et seulement à un utilisateur whitelisté.
-- Aucune autre colonne n'est exposée. Un appel porte au plus 200 adresses.
CREATE OR REPLACE FUNCTION public.noms_affiches(_emails text[])
RETURNS TABLE (email text, nom text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Appelant non whitelisté : aucune ligne.
  IF NOT private.is_allowed() THEN
    RETURN;
  END IF;

  IF cardinality(coalesce(_emails, '{}'::text[])) > 200 THEN
    RAISE EXCEPTION 'Maximum 200 adresses par appel.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT au.email, btrim(concat_ws(' ', au.first_name, au.last_name))
  FROM public.allowed_users au
  WHERE au.email = ANY (SELECT lower(e) FROM unnest(coalesce(_emails, '{}'::text[])) AS e)
    AND btrim(concat_ws(' ', au.first_name, au.last_name)) <> '';
END
$$;

REVOKE ALL ON FUNCTION public.noms_affiches(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.noms_affiches(text[]) TO authenticated;
