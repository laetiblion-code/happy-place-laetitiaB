import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const LOT_NOMS = 200;

const normaliser = (valeur: string) => valeur.trim().toLowerCase();

/** Prénom + nom quand ils existent, sinon l'e-mail (ou la valeur telle quelle si ce n'est pas un e-mail). */
export function nomAffiche(valeur: string, noms: Map<string, string> | undefined): string {
  if (!valeur.includes("@")) return valeur;
  return noms?.get(normaliser(valeur)) || valeur;
}

/** Noms de la liste blanche pour les e-mails donnés (fonction public.noms_affiches). */
export async function fetchNoms(valeurs: string[]): Promise<Map<string, string>> {
  const emails = [...new Set(valeurs.filter((v) => v.includes("@")).map(normaliser))];
  const noms = new Map<string, string>();
  if (emails.length === 0) return noms;
  // La fonction refuse plus de 200 adresses par appel.
  for (let i = 0; i < emails.length; i += LOT_NOMS) {
    const { data, error } = await supabase.rpc("noms_affiches", {
      _emails: emails.slice(i, i + LOT_NOMS),
    });
    if (error) throw error;
    for (const ligne of data ?? []) noms.set(normaliser(ligne.email), ligne.nom);
  }
  return noms;
}

export function useNomsAffiches(valeurs: string[]) {
  const emails = [...new Set(valeurs.filter((v) => v.includes("@")).map(normaliser))].sort();
  return useQuery({
    queryKey: ["noms_affiches", emails],
    queryFn: () => fetchNoms(emails),
    enabled: emails.length > 0,
    staleTime: 5 * 60_000,
  });
}
