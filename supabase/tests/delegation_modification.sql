-- ============================================================
-- Test de la délégation recalculée à la modification (protect_news_delegation)
-- À coller dans Supabase > SQL Editor, puis Run, après la migration.
-- Transaction annulée à la fin (ROLLBACK). Attendu : toutes les lignes à « true ».
-- ============================================================
BEGIN;

CREATE TEMP TABLE dm_resultats (n serial, test text, ok boolean, detail text) ON COMMIT DROP;
GRANT ALL ON dm_resultats TO authenticated;
GRANT USAGE ON SEQUENCE dm_resultats_n_seq TO authenticated;

DO $$
DECLARE
  _id uuid; _news uuid; _a text; _d text; _n int;
BEGIN
  INSERT INTO public.allowed_users(email, first_name) VALUES ('dm.admin@test.invalid', 'Odile') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'admin');
  INSERT INTO public.allowed_users(email, first_name) VALUES ('dm.manager@test.invalid', 'Julie') RETURNING id INTO _id;
  INSERT INTO public.allowed_user_roles(allowed_user_id, role) VALUES (_id, 'manager');

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', '{"email":"dm.admin@test.invalid"}', true);

  -- 1. L'admin publie sous son propre nom : pas de délégation.
  INSERT INTO public.news(title, body, author, status) VALUES ('ZZ test réattribution', 'Texte', 'Odile', 'publiée')
  RETURNING id, delegated_by_email INTO _news, _d;
  INSERT INTO dm_resultats(test, ok, detail) VALUES ('Création par l''admin pour lui-même : pas de délégation', _d IS NULL, coalesce(_d, 'aucune'));

  -- 2. L'admin réattribue à Julie : délégation = admin.
  UPDATE public.news SET author = 'Julie', author_email = 'DM.Manager@test.invalid' WHERE id = _news;
  SELECT author_email, delegated_by_email INTO _a, _d FROM public.news WHERE id = _news;
  INSERT INTO dm_resultats(test, ok, detail) VALUES ('Réattribution à une manager : « via admin »', _a = 'dm.manager@test.invalid' AND _d = 'dm.admin@test.invalid', _a || ' via ' || coalesce(_d, 'rien'));

  -- 3. L'admin modifie le texte sans changer l'autrice : délégation conservée.
  UPDATE public.news SET body = 'Texte corrigé', delegated_by_email = NULL WHERE id = _news;
  SELECT delegated_by_email INTO _d FROM public.news WHERE id = _news;
  INSERT INTO dm_resultats(test, ok, detail) VALUES ('Modification du texte : délégation conservée (non falsifiable)', _d = 'dm.admin@test.invalid', coalesce(_d, 'effacée'));

  -- 4. L'admin se réattribue l'actualité : plus de délégation.
  UPDATE public.news SET author = 'Odile', author_email = 'dm.admin@test.invalid' WHERE id = _news;
  SELECT delegated_by_email INTO _d FROM public.news WHERE id = _news;
  INSERT INTO dm_resultats(test, ok, detail) VALUES ('Réattribution à l''admin : délégation retirée', _d IS NULL, coalesce(_d, 'aucune'));

  -- 5. Un manager ne change pas l'autrice de sa propre actualité.
  UPDATE public.news SET author_email = 'dm.manager@test.invalid' WHERE id = _news;
  PERFORM set_config('request.jwt.claims', '{"email":"dm.manager@test.invalid"}', true);
  INSERT INTO public.news(title, body, author, status) VALUES ('ZZ test manager', 'Texte', 'Julie', 'brouillon') RETURNING id INTO _news;
  UPDATE public.news SET author_email = 'dm.admin@test.invalid' WHERE id = _news;
  SELECT author_email INTO _a FROM public.news WHERE id = _news;
  INSERT INTO dm_resultats(test, ok, detail) VALUES ('Manager : ne peut pas changer l''autrice', _a = 'dm.manager@test.invalid', _a);

  RESET ROLE;
END $$;

SELECT test, ok, detail FROM dm_resultats ORDER BY n;
ROLLBACK;
