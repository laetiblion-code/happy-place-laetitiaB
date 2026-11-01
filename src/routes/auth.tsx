import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandHeader } from "@/components/brand-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Connexion par mot de passe (décision du 2026-10-30) via Supabase Auth.
// Le lien e-mail (signInWithOtp) ne sert plus qu'à la première connexion ou à un mot de passe oublié :
// il renvoie vers /mot-de-passe, où l'on choisit son mot de passe.
// L'accès à l'application reste réservé à la liste blanche gérée par un admin.

const PASSWORD_PAGE = "/mot-de-passe";
const RATE_LIMIT_MESSAGE =
  "Trop de demandes de lien pour le moment. Réessaie dans une heure ou contacte un administrateur.";
const LINK_SENT_MESSAGE =
  "Si ton adresse est autorisée, tu vas recevoir un lien pour choisir ton mot de passe. Ouvre-le depuis ce navigateur.";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Happy Place" },
      { name: "description", content: "Happy Place, le dashboard interne de Bigger Boat." },
    ],
  }),
  component: ConnexionPage,
});

/** Limite d'envoi d'e-mails de Supabase : code 429 ou message « rate limit ». */
function isRateLimit(err: { message: string; status?: number }) {
  return err.status === 429 || /rate limit/i.test(err.message);
}

function ConnexionPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkSending, setLinkSending] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    // Sauf retour explicite vers la page de mot de passe, une session existante mène à l'accueil.
    const next = new URLSearchParams(window.location.search).get("next");
    const stay = next === PASSWORD_PAGE;
    const goHome = () => {
      if (!stay) navigate({ to: "/" });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goHome();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) goHome();
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address || !password) return;
    setSigningIn(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: address, password });
    setSigningIn(false);
    // Même message dans tous les cas : on ne dit pas si l'adresse existe.
    if (err) setError("Email ou mot de passe incorrect.");
  }

  async function handleLink(e: FormEvent) {
    e.preventDefault();
    const address = linkEmail.trim().toLowerCase();
    if (!address) return;
    setLinkSending(true);
    setLinkError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: window.location.origin + PASSWORD_PAGE },
    });
    setLinkSending(false);
    if (err && isRateLimit(err)) {
      setLinkError(RATE_LIMIT_MESSAGE);
      return;
    }
    // Message identique quelle que soit l'adresse, y compris en cas d'autre erreur.
    setLinkSent(true);
  }

  function backToSignIn() {
    setLinkOpen(false);
    setLinkSent(false);
    setLinkError(null);
  }

  return (
    <div className="min-h-dvh w-full bg-background flex flex-col">
      <BrandHeader />
      <main className="flex flex-1 items-center justify-center px-md py-lg">
        <section className="w-[min(100%,28rem)] border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
          <h1 className="font-headline-lg text-headline-lg text-primary">Happy Place</h1>

          {!linkOpen ? (
            <form onSubmit={handleSignIn} className="mt-md flex flex-col gap-sm">
              <label
                htmlFor="email"
                className="font-label-sm text-label-sm uppercase text-on-surface-variant"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@exemple.com"
                className="h-12 rounded-none"
              />

              <label
                htmlFor="password"
                className="font-label-sm text-label-sm uppercase text-on-surface-variant"
              >
                Mot de passe
              </label>
              <div className="flex gap-xs">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-controls="password"
                  aria-pressed={showPassword}
                  className="min-h-[44px] min-w-[88px] border border-outline bg-surface px-sm font-label-md text-label-md text-primary hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {showPassword ? "Masquer" : "Afficher"}
                </button>
              </div>

              {error && (
                <p
                  className="border border-error bg-error-container p-sm font-body-sm text-on-error-container"
                  role="alert"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={signingIn}
                className="mt-sm h-12 w-full rounded-none font-label-md text-xs uppercase text-on-primary focus-visible:ring-2 focus-visible:ring-primary"
              >
                {signingIn ? "Connexion…" : "Se connecter"}
              </Button>

              <button
                type="button"
                onClick={() => setLinkOpen(true)}
                className="min-h-[44px] self-start font-body-sm text-body-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Première connexion ou mot de passe oublié ?
              </button>
            </form>
          ) : linkSent ? (
            <div className="mt-md flex flex-col gap-sm">
              <p className="font-body-md text-body-md text-on-surface-variant" role="status">
                {LINK_SENT_MESSAGE}
              </p>
              <button
                type="button"
                onClick={backToSignIn}
                className="min-h-[44px] self-start font-body-sm text-body-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
            <form onSubmit={handleLink} className="mt-md flex flex-col gap-sm">
              <label
                htmlFor="email-lien"
                className="font-label-sm text-label-sm uppercase text-on-surface-variant"
              >
                Email
              </label>
              <Input
                id="email-lien"
                type="email"
                required
                autoComplete="email"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                placeholder="prenom.nom@exemple.com"
                className="h-12 rounded-none"
              />
              {linkError && (
                <p
                  className="border border-error bg-error-container p-sm font-body-sm text-on-error-container"
                  role="alert"
                >
                  {linkError}
                </p>
              )}
              <Button
                type="submit"
                disabled={linkSending}
                className="mt-sm h-12 w-full rounded-none font-label-md text-xs uppercase text-on-primary focus-visible:ring-2 focus-visible:ring-primary"
              >
                {linkSending ? "Envoi…" : "Recevoir un lien"}
              </Button>
              <button
                type="button"
                onClick={backToSignIn}
                className="min-h-[44px] self-start font-body-sm text-body-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Retour à la connexion
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
