import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BrandHeader } from "@/components/brand-header";
import { AccountBar } from "@/components/account-bar";
import { fetchOwnRole, signOut, type AppRole } from "@/lib/auth";
import { exportMyRecentSubmissions } from "@/lib/dashboard";
import { supabase } from "@/integrations/supabase/client";

const LIBELLE_ROLE: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
  collaborateur: "Collaborateur",
};

/**
 * En-tête de toutes les pages. Si une personne autorisée est connectée, le bloc du compte est affiché
 * (prénom, rôle, actions). Sinon, l'en-tête reste sans bloc utilisateur (connexion, premier accès).
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

  const exporter = useMutation({
    mutationFn: (email: string) => exportMyRecentSubmissions(email),
    onSuccess: (count) => {
      if (count === 0) {
        toast.info("Aucune demande sur les 30 derniers jours.");
        return;
      }
      toast.success(
        `${count} demande${count > 1 ? "s" : ""} exportée${count > 1 ? "s" : ""} au format CSV.`,
      );
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const compte = session.data;
  if (!compte) return <BrandHeader />;

  return (
    <BrandHeader
      account={
        <AccountBar
          firstName={compte.firstName}
          email={compte.email}
          roleLabel={LIBELLE_ROLE[compte.role]}
          isAdmin={compte.role === "admin"}
          exporting={exporter.isPending}
          onExport={() => exporter.mutate(compte.email)}
          onSignOut={() => void signOut()}
        />
      }
    />
  );
}
