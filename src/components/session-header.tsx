import { useQuery } from "@tanstack/react-query";
import { BrandHeader } from "@/components/brand-header";
import { AccountBar } from "@/components/account-bar";
import { MainNav } from "@/components/main-nav";
import { fetchOwnRole, signOut, type AppRole } from "@/lib/auth";
import { useExportMesDemandes } from "@/hooks/use-export-mes-demandes";
import { supabase } from "@/integrations/supabase/client";

const LIBELLE_ROLE: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
  collaborateur: "Collaborateur",
};

/**
 * En-tête de toutes les pages. Si une personne autorisée est connectée, le bloc du compte est affiché
 * (prénom, rôle, avatar, déconnexion). Pour l'admin, la barre d'onglets est ajoutée sous l'en-tête.
 * Sans session, l'en-tête reste sans bloc utilisateur (connexion, premier accès).
 */
export function SessionHeader() {
  const session = useQuery({
    queryKey: ["session-header"],
    queryFn: async () => {
      // Sans session, getUser renvoie une erreur : c'est le cas « personne n'est connecté ».
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email?.toLowerCase() ?? "";
      if (!email) return null;
      const [role, profil] = await Promise.all([
        fetchOwnRole(email),
        supabase.from("allowed_users").select("first_name").eq("email", email).maybeSingle(),
      ]);
      if (!role) return null;
      return { email, role, firstName: profil.data?.first_name?.trim() ?? "" };
    },
    retry: false,
  });

  const compte = session.data;
  const exporter = useExportMesDemandes(compte?.email ?? "");

  if (!compte) return <BrandHeader />;

  return (
    <>
      <BrandHeader
        account={
          <AccountBar
            firstName={compte.firstName}
            email={compte.email}
            roleLabel={LIBELLE_ROLE[compte.role]}
            showExport={compte.role !== "collaborateur"}
            exporting={exporter.isPending}
            onExport={() => exporter.mutate()}
            onSignOut={() => void signOut()}
          />
        }
      />
      {compte.role === "admin" && <MainNav />}
    </>
  );
}
