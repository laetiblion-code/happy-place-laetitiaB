-- « Compléter ma demande » après une demande de clarification (T5, EP3, critère CA3.x).
-- L'auteur d'une demande refusée avec le motif « à clarifier » répond à la question du manager.
-- La demande repasse « en attente » chez ses managers ; l'historique enregistre le changement
-- (trigger record_submission_status). Aucun droit de mise à jour direct n'est donné à l'auteur :
-- tout passe par cette fonction, qui vérifie l'auteur, le statut et le motif.
CREATE OR REPLACE FUNCTION public.completer_ma_demande(_id uuid, _reponse text, _contenu text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _moi text := lower(auth.jwt() ->> 'email');
  _d public.submissions%ROWTYPE;
  _texte text;
BEGIN
  IF NOT private.is_allowed() THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _d FROM public.submissions WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR _d.submitted_by_email IS DISTINCT FROM _moi THEN
    RAISE EXCEPTION 'Tu ne peux compléter que tes propres demandes.' USING ERRCODE = '42501';
  END IF;
  IF _d.status <> 'refusée'::public.submission_status OR _d.rejection_category IS DISTINCT FROM 'à clarifier'::public.rejection_category THEN
    RAISE EXCEPTION 'Cette demande n''attend pas de clarification.' USING ERRCODE = '22023';
  END IF;
  IF btrim(coalesce(_reponse, '')) = '' THEN
    RAISE EXCEPTION 'Écris ta réponse à la question de ton manager.' USING ERRCODE = '22023';
  END IF;

  _texte := btrim(coalesce(nullif(btrim(_contenu), ''), _d.content))
            || E'\n\nRéponse à la clarification : ' || btrim(_reponse);
  IF char_length(_texte) > 2000 THEN
    RAISE EXCEPTION 'Ta demande et ta réponse dépassent 2 000 caractères. Raccourcis-les.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.submissions
     SET content = _texte,
         status = 'en attente'::public.submission_status,
         rejection_category = NULL,
         rejection_note = NULL
   WHERE id = _id;
END
$$;

REVOKE ALL ON FUNCTION public.completer_ma_demande(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.completer_ma_demande(uuid, text, text) TO authenticated;
