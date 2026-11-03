import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SessionHeader } from "@/components/session-header";
import { DemandesCabinet } from "@/components/cabinet-demandes";
import { SubmissionReader } from "@/components/submission-reader";
import type { Submission } from "@/lib/dashboard";
import { buttonVariants } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/demandes")({
  head: () => ({
    meta: [
      { title: "Demandes · Happy Place" },
      { name: "description", content: "Toutes les demandes du cabinet que tu peux lire." },
      { property: "og:title", content: "Demandes · Happy Place" },
      { property: "og:type", content: "website" },
    ],
  }),
  // L'administrateur gère les demandes dans la gestion ; cette page est pour les managers et collaborateurs
  beforeLoad: ({ context }) => {
    if (context.role === "admin") throw redirect({ to: "/manage/submissions" });
  },
  component: DemandesPage,
});

function DemandesPage() {
  const { role, email } = Route.useRouteContext();
  const myEmail = (email ?? "").toLowerCase();
  const roleAffiche = role === "manager" ? "manager" : "collaborateur";
  const [lue, setLue] = useState<Submission | null>(null);

  // Équipes gérées : elles donnent accès aux pièces jointes de ces équipes (même règle que l'accueil)
  const myTeams = useQuery({
    queryKey: ["manager_teams", "mine", email],
    enabled: role === "manager" && !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manager_teams")
        .select("team, allowed_users!inner(email)")
        .eq("allowed_users.email", myEmail);
      if (error) throw error;
      return (data ?? []).map((t) => t.team).sort();
    },
  });

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen">
      <SessionHeader />
      <main id="contenu" tabIndex={-1} className="focus:outline-none w-full max-w-interface mx-auto p-sm md:p-md space-y-md">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-sm">
          <h1 className="font-headline-lg text-headline-lg text-primary">Demandes du cabinet</h1>
          <Link to="/" className={buttonVariants({ variant: "secondary" })}>
            ← Retour à l'accueil
          </Link>
        </div>
        {(role !== "manager" || myTeams.isSuccess) && (
          <DemandesCabinet
            email={myEmail}
            role={roleAffiche}
            managerTeams={myTeams.data ?? []}
            onRead={setLue}
            variante="page"
          />
        )}
      </main>
      <SubmissionReader
          moi={myEmail} submission={lue} onClose={() => setLue(null)} />
    </div>
  );
}
