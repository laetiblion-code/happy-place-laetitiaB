import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandHeader } from "@/components/brand-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Connexion par lien magique (email) via Supabase Auth.
// L'accès à l'application reste réservé à la liste blanche gérée par un admin.

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

function ConnexionPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) return;
    setSending(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (err) {
      setError(`Impossible d'envoyer le lien : ${err.message}`);
      return;
    }
    setSentTo(address);
  }

  return (
    <div className="min-h-dvh w-full bg-background flex flex-col">
      <BrandHeader />
      <main className="flex flex-1 items-center justify-center px-md py-lg">
        <section className="w-[min(100%,28rem)] border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
          <h1 className="font-headline-lg text-headline-lg text-primary">Happy Place</h1>
          {sentTo ? (
            <>
              <p className="mt-sm font-body-md text-body-md text-on-surface-variant" role="status">
                Un lien de connexion a été envoyé à <strong>{sentTo}</strong>. Ouvre-le depuis ce
                navigateur.
              </p>
              <Button
                variant="outline"
                onClick={() => setSentTo(null)}
                className="mt-md h-12 w-full rounded-none font-label-md text-xs uppercase"
              >
                UTILISER UNE AUTRE ADRESSE
              </Button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="mt-md flex flex-col gap-sm">
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
                disabled={sending}
                className="mt-sm h-12 w-full rounded-none font-label-md text-xs uppercase text-on-primary"
              >
                {sending ? "Envoi…" : "Recevoir mon lien de connexion"}
              </Button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
