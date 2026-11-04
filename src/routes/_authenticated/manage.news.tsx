import { createFileRoute, redirect } from "@tanstack/react-router";

// Ancienne page de gestion des actualités : l'admin gère tout depuis /actualites (une seule page).
// Gardée en redirection pour les favoris et les anciens liens.
export const Route = createFileRoute("/_authenticated/manage/news")({
  beforeLoad: () => {
    throw redirect({ to: "/actualites", replace: true });
  },
});
