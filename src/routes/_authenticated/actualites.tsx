import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SessionHeader } from "@/components/session-header";
import { ActualitesCabinet } from "@/components/actualites-cabinet";
import { buttonVariants } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/actualites")({
  head: () => ({
    meta: [
      { title: "Actualités · Happy Place" },
      { name: "description", content: "Toutes les actualités publiées du cabinet." },
      { property: "og:title", content: "Actualités · Happy Place" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ActualitesPage,
});

function ActualitesPage() {
  const { role, email } = Route.useRouteContext();
  const canWrite = role === "admin" || role === "manager";
  const roleAffiche = role === "admin" || role === "manager" ? role : "collaborateur";
  const myEmail = (email ?? "").toLowerCase();
  // Prénom, nom et équipe lus dans la ligne de la personne connectée (même requête que l'accueil)
  const profile = useQuery({
    queryKey: ["allowed_user_profile", myEmail],
    enabled: !!myEmail,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allowed_users")
        .select("first_name, last_name, team")
        .eq("email", myEmail)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });
  const profileName = [profile.data?.first_name, profile.data?.last_name]
    .map((p) => p?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  // Compteur : chaque clic sur « Nouvelle actu » ouvre la rédaction
  const [ouvertureActu, setOuvertureActu] = useState(0);

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen">
      <SessionHeader />
      <main id="contenu" tabIndex={-1} className="focus:outline-none w-full max-w-interface mx-auto p-sm md:p-md space-y-md">
        <header className="flex flex-col gap-sm md:flex-row md:items-end md:justify-between">
          <h1 className="font-headline-lg text-headline-lg text-primary">Actualités</h1>
          <div className="flex flex-wrap gap-xs">
            <Link to="/" className={buttonVariants({ variant: "secondary" })}>
              ← Retour à l'accueil
            </Link>
            {canWrite && (
              <button
                type="button"
                onClick={() => setOuvertureActu((n) => n + 1)}
                className={buttonVariants({ variant: "default" })}
              >
                <span aria-hidden="true" className="material-symbols-outlined">edit_note</span> Nouvelle actu
              </button>
            )}
          </div>
        </header>

        <ActualitesCabinet
          mode="page"
          role={roleAffiche}
          email={myEmail}
          auteur={profileName || myEmail}
          equipe={profile.data?.team ?? ""}
          ouvertureDemandee={ouvertureActu}
        />
      </main>
    </div>
  );
}
