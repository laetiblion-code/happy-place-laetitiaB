-- ============================================================
-- Gestion des utilisateurs (T26). Décisions du 2026-11-01.
-- 1. Lien de première connexion réservé à la liste blanche (hook Supabase
--    « Before User Created », à activer dans Authentication > Hooks).
-- 2. Statut de connexion de chaque utilisateur, lisible par l'admin seulement.
-- 3. Import : au moins une équipe pour un manager, plusieurs séparées par « ; ».
-- ============================================================
BEGIN;

-- 1. Hook : refuse la création d'un compte de connexion pour une adresse
--    absente de la liste blanche. Aucun e-mail n'est alors envoyé.
CREATE OR REPLACE FUNCTION public.hook_before_user_created(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.allowed_users
              WHERE email = lower(btrim(coalesce(event->'user'->>'email', '')))) THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN jsonb_build_object('error', jsonb_build_object(
    'message', 'Adresse non autorisée.', 'http_code', 403));
END
$$;
GRANT EXECUTE ON FUNCTION public.hook_before_user_created(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_before_user_created(jsonb) FROM authenticated, anon, public;

-- 2. Statut de connexion, pour l'admin
CREATE OR REPLACE FUNCTION public.admin_users_status()
RETURNS TABLE (email text, a_un_compte boolean, mot_de_passe_cree boolean, derniere_connexion timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Réservé aux admins.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT au.email,
         u.id IS NOT NULL,
         coalesce(u.encrypted_password, '') <> '',
         u.last_sign_in_at
  FROM public.allowed_users au
  LEFT JOIN auth.users u ON lower(u.email) = au.email;
END
$$;
REVOKE ALL ON FUNCTION public.admin_users_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_users_status() TO authenticated;

-- 3. Import des utilisateurs
CREATE OR REPLACE FUNCTION public.bulk_import_allowed_users(_rows jsonb, _dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _r jsonb; _i int := 0; _line int;
  _email text; _first text; _last text; _role_txt text; _team text; _teams text[]; _t text;
  _role public.app_role; _reason text; _id uuid;
  _out jsonb := '[]'::jsonb; _dup_emails text[]; _ok int := 0; _ko int := 0;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Seul un admin peut importer des utilisateurs.' USING ERRCODE = '42501';
  END IF;
  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array' THEN
    RAISE EXCEPTION 'Format invalide : une liste de lignes est attendue.';
  END IF;
  IF jsonb_array_length(_rows) = 0 THEN RAISE EXCEPTION 'Le fichier ne contient aucune ligne.'; END IF;
  IF jsonb_array_length(_rows) > 500 THEN
    RAISE EXCEPTION 'Maximum 500 lignes par import (% reçues).', jsonb_array_length(_rows);
  END IF;
  SELECT coalesce(array_agg(e), '{}') INTO _dup_emails FROM (
    SELECT lower(btrim(x->>'email')) e FROM jsonb_array_elements(_rows) x
    WHERE coalesce(btrim(x->>'email'), '') <> '' GROUP BY 1 HAVING count(*) > 1) d;
  FOR _r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    _i := _i + 1;
    _line := coalesce((_r->>'line')::int, _i + 1);
    _email := lower(btrim(coalesce(_r->>'email', '')));
    _first := nullif(btrim(coalesce(_r->>'first_name', '')), '');
    _last := nullif(btrim(coalesce(_r->>'last_name', '')), '');
    _role_txt := lower(btrim(coalesce(_r->>'role', '')));
    _team := nullif(btrim(coalesce(_r->>'team', '')), '');
    -- Plusieurs équipes possibles pour un manager, séparées par « ; »
    SELECT coalesce(array_agg(coalesce((SELECT t.name FROM public.teams t WHERE lower(t.name) = lower(btrim(x))), btrim(x))), '{}')
      INTO _teams
      FROM unnest(string_to_array(coalesce(_team, ''), ';')) x WHERE btrim(x) <> '';
    _team := CASE WHEN cardinality(_teams) > 0 THEN array_to_string(_teams, '; ') END;
    _reason := NULL;
    IF _last IS NULL THEN _reason := 'Nom manquant';
    ELSIF _first IS NULL THEN _reason := 'Prénom manquant';
    ELSIF char_length(_last) > 100 OR char_length(_first) > 100 THEN _reason := 'Nom ou prénom trop long (100 caractères maximum)';
    ELSIF _email = '' THEN _reason := 'Adresse mail manquante';
    ELSIF char_length(_email) > 255 OR _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN _reason := 'Adresse mail invalide';
    ELSIF _email = ANY(_dup_emails) THEN _reason := 'Adresse mail en double dans le fichier : une adresse ne peut avoir qu''un seul rôle';
    ELSIF EXISTS (SELECT 1 FROM public.allowed_users WHERE email = _email) THEN _reason := 'Adresse mail déjà autorisée';
    ELSIF _role_txt NOT IN ('admin', 'manager', 'collaborateur') THEN _reason := 'Rôle invalide (collaborateur, manager ou admin)';
    ELSIF EXISTS (SELECT 1 FROM unnest(_teams) x WHERE NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.name = x)) THEN _reason := 'Équipe inconnue : choisis une équipe de la liste';
    ELSIF _role_txt = 'collaborateur' AND cardinality(_teams) = 0 THEN _reason := 'Équipe obligatoire pour un collaborateur';
    ELSIF _role_txt = 'manager' AND cardinality(_teams) = 0 THEN _reason := 'Au moins une équipe obligatoire pour un manager';
    ELSIF _role_txt = 'collaborateur' AND cardinality(_teams) > 1 THEN _reason := 'Un collaborateur appartient à une seule équipe';
    ELSIF cardinality(_teams) <> (SELECT count(DISTINCT lower(x)) FROM unnest(_teams) x) THEN _reason := 'Équipe en double sur la ligne';
    ELSIF _role_txt IN ('collaborateur', 'manager') AND EXISTS (SELECT 1 FROM unnest(_teams) x WHERE lower(x) = 'admin') THEN _reason := 'L''équipe Admin est réservée aux admins';
    ELSIF _role_txt = 'admin' AND (cardinality(_teams) > 1 OR (cardinality(_teams) = 1 AND lower(_teams[1]) <> 'admin')) THEN _reason := 'Un admin appartient à l''équipe Admin : laisser vide ou choisir Admin';
    END IF;
    IF _reason IS NULL THEN
      _role := _role_txt::public.app_role;
      BEGIN
        INSERT INTO public.allowed_users (email, team, first_name, last_name)
        VALUES (_email, CASE WHEN _role = 'collaborateur' THEN _teams[1] END, _first, _last)
        RETURNING id INTO _id;
        INSERT INTO public.allowed_user_roles (allowed_user_id, role) VALUES (_id, _role);
        IF _role = 'manager' THEN
          FOREACH _t IN ARRAY _teams LOOP
            INSERT INTO public.manager_teams (allowed_user_id, team) VALUES (_id, _t);
          END LOOP;
        END IF;
        IF _dry_run THEN RAISE EXCEPTION 'HP_DRY_RUN_OK'; END IF;
      EXCEPTION
        WHEN unique_violation THEN _reason := 'Adresse mail déjà utilisée';
        WHEN check_violation THEN _reason := 'Valeur refusée par la base (' || SQLERRM || ')';
        WHEN foreign_key_violation THEN _reason := 'Équipe inconnue : choisis une équipe de la liste';
        WHEN OTHERS THEN IF SQLERRM <> 'HP_DRY_RUN_OK' THEN _reason := SQLERRM; END IF;
      END;
    END IF;
    IF _reason IS NULL THEN _ok := _ok + 1; ELSE _ko := _ko + 1; END IF;
    _out := _out || jsonb_build_object(
      'line', _line, 'email', _email, 'last_name', _last, 'first_name', _first,
      'role', _role_txt, 'team', _team,
      'status', CASE WHEN _reason IS NOT NULL THEN 'refusée' WHEN _dry_run THEN 'valide' ELSE 'importée' END,
      'reason', _reason);
  END LOOP;
  RETURN jsonb_build_object('dry_run', _dry_run, 'accepted', _ok, 'rejected', _ko, 'rows', _out);
END;
$function$;

COMMIT;
