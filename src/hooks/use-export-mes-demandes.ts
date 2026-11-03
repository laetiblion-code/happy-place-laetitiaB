import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { exportMyRecentSubmissions } from "@/lib/dashboard";

/** Libellé de l'info-bulle de l'export : même période et même fichier partout (en-tête, accueil). */
export const EXPORT_INFO_MES_DEMANDES = "30 derniers jours, tous statuts";

/** Export CSV des demandes de la personne connectée sur 30 jours (mêmes règles d'accès que l'accueil). */
export function useExportMesDemandes(email: string) {
  return useMutation({
    mutationFn: () => exportMyRecentSubmissions(email),
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
}
