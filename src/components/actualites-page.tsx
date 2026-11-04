import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SessionHeader } from "@/components/session-header";
import { ActualitesCabinet } from "@/components/actualites-cabinet";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Page « Actualités » (`/actualites`, seule page de gestion des actualités ; `/manage/news` y redirige). Publiées à gauche, brouillons à droite,
 * dans un bloc blanc. Les droits suivent les règles de la base : admin sur toutes, manager sur les siennes,
 * collaborateur en lecture.
 */
export function ActualitesPage({
  role,
  email,
}: {
  role: "admin" | "manager" | "collaborateur" | string;
  email: string;
}) {
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
