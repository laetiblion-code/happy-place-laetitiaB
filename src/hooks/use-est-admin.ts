import { useRouteContext } from "@tanstack/react-router";

/** Vrai pour l'admin. Lit le rôle du contexte de la zone connectée (même source que les pages). */
export function useEstAdmin(): boolean {
  return useRouteContext({ from: "/_authenticated", select: (c) => c.role === "admin" });
}
