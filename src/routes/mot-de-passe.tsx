import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandHeader } from "@/components/brand-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Choix du mot de passe : arrivée par le lien e-mail (première connexion ou mot de passe oublié),
// ou depuis l'en-tête de l'accueil pour changer de mot de passe. Hors de la zone authentifiée :
// la liste blanche est vérifiée par l'accueil, pas ici.

const MIN_LENGTH = 8;

export const Route = createFileRoute("/mot-de-passe")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Happy Place — Choisis ton mot de passe" }],
  }),
  component: ChoisirMotDePasse,
});

type Phase = "verification" | "pret" | "expire";

function ChoisirMotDePasse() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("verification");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Supabase lit le lien dans l'URL ; on attend son résultat avant de décider.
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setPhase(data.session ? "pret" : "expire");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && active) setPhase("pret");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => navigate({ to: "/" }), 1500);
    return () => window.clearTimeout(timer);
  }, [saved, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const tooShort = password.length < MIN_LENGTH;
    const mismatch = !tooShort && password !== confirm;
    setPasswordError(tooShort ? `${MIN_LENGTH} caractères minimum.` : null);
    setConfirmError(mismatch ? "Les deux mots de passe ne sont pas identiques." : null);
    setFormError(null);
    if (tooShort || mismatch) return;

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setFormError(`Impossible d'enregistrer le mot de passe : ${error.message}`);
      return;
    }
    setSaved(true);
  }

  const card = (children: ReactNode) => (
    <div className="min-h-dvh w-full bg-background flex flex-col">
      <BrandHeader />
      <main className="flex flex-1 items-center justify-center px-md py-lg">
        <section className="w-[min(100%,28rem)] border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
          {children}
        </section>
      </main>
    </div>
  );

  if (phase === "verification") {
    return card(
      <p className="font-body-md text-body-md text-on-surface-variant" role="status">
        Vérification du lien…
      </p>,
    );
  }

  if (phase === "expire") {
    return card(
      <>
        <h1 className="font-headline-lg text-headline-lg text-primary">Lien expiré</h1>
        <p className="mt-sm font-body-md text-body-md text-on-surface-variant" role="alert">
          Ce lien a expiré ou a déjà été utilisé.
        </p>
        <Link
          to="/auth"
          className="mt-md inline-flex min-h-[44px] items-center font-body-sm text-body-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Retour à la connexion
        </Link>
      </>,
    );
  }

  return card(
    <>
      <h1 className="font-headline-lg text-headline-lg text-primary">Choisis ton mot de passe</h1>
      {saved ? (
        <p className="mt-md font-body-md text-body-md text-on-surface" role="status">
          Mot de passe enregistré. Redirection vers l'accueil…
        </p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="mt-md flex flex-col gap-sm">
          <label
            htmlFor="new-password"
            className="font-label-sm text-label-sm uppercase text-on-surface-variant"
          >
            Nouveau mot de passe
          </label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="new-password-hint"
            aria-invalid={passwordError ? true : undefined}
            className="h-12 rounded-none"
          />
          <p id="new-password-hint" className="font-body-sm text-body-sm text-on-surface-variant">
            {`${MIN_LENGTH} caractères minimum`}
          </p>
          {passwordError && (
            <p className="font-body-sm text-body-sm text-error" role="alert">
              {passwordError}
            </p>
          )}

          <label
            htmlFor="confirm-password"
            className="font-label-sm text-label-sm uppercase text-on-surface-variant"
          >
            Confirme le mot de passe
          </label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={confirmError ? true : undefined}
            className="h-12 rounded-none"
          />
          {confirmError && (
            <p className="font-body-sm text-body-sm text-error" role="alert">
              {confirmError}
            </p>
          )}

          {formError && (
            <p
              className="border border-error bg-error-container p-sm font-body-sm text-on-error-container"
              role="alert"
            >
              {formError}
            </p>
          )}
          <Button
            type="submit"
            disabled={saving}
            className="mt-sm h-12 w-full rounded-none font-label-md text-xs uppercase text-on-primary focus-visible:ring-2 focus-visible:ring-primary"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      )}
    </>,
  );
}
