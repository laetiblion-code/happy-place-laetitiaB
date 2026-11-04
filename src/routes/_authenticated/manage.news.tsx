import { createFileRoute } from "@tanstack/react-router";
import { ActualitesPage } from "@/components/actualites-page";

// Gardée pour les favoris : même page que /actualites (la seule page d'actualités), sous la gestion admin.
export const Route = createFileRoute("/_authenticated/manage/news")({
  head: () => ({
    meta: [
      { title: "Actualités · Happy Place" },
      { name: "description", content: "Créez, modifiez et supprimez les actualités de Happy Place." },
      { property: "og:title", content: "Actualités · Happy Place" },
      { property: "og:description", content: "Gérez les actualités du cabinet de recrutement dans Happy Place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageNews,
});

function ManageNews() {
  const { role, email } = Route.useRouteContext();
  return <ActualitesPage role={role} email={email ?? ""} />;
}
