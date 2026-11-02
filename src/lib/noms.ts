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

/** Initiales décoratives d'un nom : prénom et nom, ou première lettre d'une adresse. */
export function initialesDe(libelle: string): string {
  if (libelle.includes("@")) return libelle.charAt(0).toUpperCase();
  const mots = libelle.trim().split(/\s+/).filter(Boolean);
  const premiere = mots[0]?.charAt(0) ?? "";
  const derniere = mots.length > 1 ? (mots[mots.length - 1]?.charAt(0) ?? "") : "";
  return `${premiere}${derniere}`.toUpperCase();
}

/** Durée entre deux dates en jours entiers, lisible : « moins d'un jour », « 2 jours ». */
export function dureeEnJours(debut: string, fin: string): string {
  const jours = Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 86_400_000);
  if (jours < 1) return "moins d'un jour";
  return `${jours} jour${jours > 1 ? "s" : ""}`;
}

/** « il y a 4 j », « il y a 3 h », « il y a 5 min » : version courte pour les tableaux. */
export function ilYaCourt(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
