-- ============================================================
-- Test : demandes des managers et des admins validées à l'envoi
-- À coller dans Supabase > SQL Editor, puis Run.
-- Transaction annulée à la fin (ROLLBACK). Attendu : toutes les lignes à « true ».
-- ============================================================
BEGIN;

CREATE TEMP TABLE staff_resultats (n serial, test text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON staff_resultats TO authenticated;
GRANT USAGE ON SEQUENCE staff_resultats_n_seq TO authenticated;

DO $$
DECLARE
  _a text := 'ZZ STAFF équipe';
  _id uuid; s uuid; _st text; _rev boolean; _h int;
BEGIN
  INSERT INTO public.teams(name) VALUES (_a);
  INSERT INTO public.allowed_users(email, team) VALUES ('staff.c1@test.invalid', _a) RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'collaborateur');
  INSERT INTO public.allowed_users(email) VALUES ('staff.mgr@test.invalid') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'manager');
  INSERT INTO public.manager_teams(allowed_user_id, team) VALUES (_id, _a);
  INSERT INTO public.allowed_users(email) VALUES ('staff.adm@test.invalid') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'admin');

  SET LOCAL ROLE authenticated;

  PERFORM set_config('request.jwt.claims', '{"email":"staff.c1@test.invalid"}', true);
  INSERT INTO public.submissions(author_name, team, content, category) VALUES ('C1', _a, 'STAFF demande collaborateur', 'idée')
    RETURNING id, status::text INTO s, _st;
  INSERT INTO staff_resultats(test, ok, detail) VALUES ('Collaborateur : sa demande part « en attente »', _st = 'en attente', _st);

  PERFORM set_config('request.jwt.claims', '{"email":"staff.mgr@test.invalid"}', true);
  BEGIN
    INSERT INTO public.submissions(author_name, team, content, category) VALUES ('M', _a, 'STAFF demande manager', 'idée')
      RETURNING id, status::text, revalidate_at IS NOT NULL INTO s, _st, _rev;
    SELECT count(*) INTO _h FROM public.submission_status_history WHERE submission_id = s;
    INSERT INTO staff_resultats(test, ok, detail) VALUES ('Manager : sa demande est validée à l''envoi', _st = 'validée', _st);
    INSERT INTO staff_resultats(test, ok, detail) VALUES ('Manager : revalidation annuelle posée et historique enregistré', _rev AND _h = 1, _h || ' ligne(s) d''historique');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO staff_resultats(test, ok, detail) VALUES ('Manager : sa demande est validée à l''envoi', false, SQLERRM);
  END;

  PERFORM set_config('request.jwt.claims', '{"email":"staff.adm@test.invalid"}', true);
  BEGIN
    INSERT INTO public.submissions(author_name, team, content, category) VALUES ('A', 'x', 'STAFF demande admin', 'question')
      RETURNING status::text INTO _st;
    INSERT INTO staff_resultats(test, ok, detail) VALUES ('Admin : sa demande est validée à l''envoi', _st = 'validée', _st);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO staff_resultats(test, ok, detail) VALUES ('Admin : sa demande est validée à l''envoi', false, SQLERRM);
  END;

  PERFORM set_config('request.jwt.claims', '{"email":"staff.c1@test.invalid"}', true);
  BEGIN
    INSERT INTO public.submissions(author_name, team, content, status) VALUES ('C1', _a, 'STAFF tentative', 'validée');
    INSERT INTO staff_resultats(test, ok, detail) VALUES ('Collaborateur : ne peut pas créer une demande déjà validée', false, 'acceptée à tort');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO staff_resultats(test, ok, detail) VALUES ('Collaborateur : ne peut pas créer une demande déjà validée', true, 'refusée par la base');
  END;
  RESET ROLE;
END $$;

SELECT test, ok, detail FROM staff_resultats ORDER BY n;
ROLLBACK;
