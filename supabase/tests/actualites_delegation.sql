-- ============================================================
-- Test des actualités : délégation admin, date de modification, droits du manager
-- À coller dans Supabase > SQL Editor, puis Run, après la migration.
-- Transaction annulée à la fin (ROLLBACK). Attendu : toutes les lignes à « true ».
-- ============================================================
BEGIN;

CREATE TEMP TABLE ad_resultats (n serial, test text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON ad_resultats TO authenticated;
GRANT USAGE ON SEQUENCE ad_resultats_n_seq TO authenticated;

DO $$
DECLARE
  _id uuid; _n int; _news uuid; _news2 uuid; _d text; _a text; _u1 timestamptz; _u2 timestamptz;
BEGIN
  INSERT INTO public.allowed_users(email, first_name) VALUES ('ad.admin@test.invalid', 'Odile') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'admin');
  INSERT INTO public.allowed_users(email, first_name) VALUES ('ad.manager@test.invalid', 'Karine') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'manager');
  INSERT INTO public.allowed_users(email, first_name) VALUES ('ad.manager2@test.invalid', 'Marc') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'manager');

  SET LOCAL ROLE authenticated;

  -- Admin publie au nom de Karine, et tente de forger la délégation.
  PERFORM set_config('request.jwt.claims', '{"email":"ad.admin@test.invalid"}', true);
  INSERT INTO public.news(title, body, author, author_email, status, delegated_by_email)
  VALUES ('ZZ test délégation', 'Texte', 'Karine', 'AD.Manager@test.invalid', 'publiée', 'pirate@test.invalid')
  RETURNING id, author_email, delegated_by_email INTO _news, _a, _d;
  INSERT INTO ad_resultats(test, ok, detail) VALUES ('Admin au nom d''un manager : autrice = manager, délégation = admin',
    _a = 'ad.manager@test.invalid' AND _d = 'ad.admin@test.invalid', _a || ' via ' || coalesce(_d, 'rien'));

  -- Admin publie pour lui-même : pas de délégation.
  INSERT INTO public.news(title, body, author, status) VALUES ('ZZ test admin seul', 'Texte', 'Odile', 'brouillon')
  RETURNING delegated_by_email INTO _d;
  INSERT INTO ad_resultats(test, ok, detail) VALUES ('Admin pour lui-même : pas de délégation', _d IS NULL, coalesce(_d, 'aucune'));

  -- Manager : modifie son actualité publiée, sans pouvoir toucher la délégation.
  PERFORM set_config('request.jwt.claims', '{"email":"ad.manager@test.invalid"}', true);
  SELECT updated_at INTO _u1 FROM public.news WHERE id = _news;
  PERFORM pg_sleep(0.01);
  UPDATE public.news SET body = 'Texte corrigé', delegated_by_email = NULL WHERE id = _news;
  GET DIAGNOSTICS _n = ROW_COUNT;
  SELECT delegated_by_email, updated_at INTO _d, _u2 FROM public.news WHERE id = _news;
  INSERT INTO ad_resultats(test, ok, detail) VALUES ('Manager : modifie son actualité publiée', _n = 1, _n || ' ligne(s)');
  INSERT INTO ad_resultats(test, ok, detail) VALUES ('Manager : la délégation reste inchangée', _d = 'ad.admin@test.invalid', coalesce(_d, 'effacée'));
  INSERT INTO ad_resultats(test, ok, detail) VALUES ('updated_at avance à chaque modification', _u2 > _u1, '');

  -- Un autre manager ne peut ni modifier ni supprimer.
  PERFORM set_config('request.jwt.claims', '{"email":"ad.manager2@test.invalid"}', true);
  UPDATE public.news SET body = 'Piraté' WHERE id = _news;
  GET DIAGNOSTICS _n = ROW_COUNT;
  INSERT INTO ad_resultats(test, ok, detail) VALUES ('Autre manager : ne modifie pas', _n = 0, _n || ' ligne(s)');
  DELETE FROM public.news WHERE id = _news;
  GET DIAGNOSTICS _n = ROW_COUNT;
  INSERT INTO ad_resultats(test, ok, detail) VALUES ('Autre manager : ne supprime pas', _n = 0, _n || ' ligne(s)');

  -- La manager supprime son actualité publiée.
  PERFORM set_config('request.jwt.claims', '{"email":"ad.manager@test.invalid"}', true);
  DELETE FROM public.news WHERE id = _news;
  GET DIAGNOSTICS _n = ROW_COUNT;
  INSERT INTO ad_resultats(test, ok, detail) VALUES ('Manager : supprime son actualité publiée', _n = 1, _n || ' ligne(s)');

  -- Un manager ne publie pas au nom d'un autre.
  INSERT INTO public.news(title, body, author, author_email, status) VALUES ('ZZ test forge', 'Texte', 'Marc', 'ad.manager2@test.invalid', 'brouillon')
  RETURNING author_email, delegated_by_email INTO _a, _d;
  INSERT INTO ad_resultats(test, ok, detail) VALUES ('Manager : ne peut pas écrire au nom d''un autre', _a = 'ad.manager@test.invalid' AND _d IS NULL, _a);

  RESET ROLE;
END $$;

SELECT test, ok, detail FROM ad_resultats ORDER BY n;
ROLLBACK;
