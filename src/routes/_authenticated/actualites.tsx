import { createFileRoute } from "@tanstack/react-router";
import { ActualitesPage } from "@/components/actualites-page";

export const Route = createFileRoute("/_authenticated/actualites")({
  head: () => ({
    meta: [
      { title: "Actualités · Happy Place" },
      { name: "description", content: "Toutes les actualités publiées du cabinet." },
      { property: "og:title", content: "Actualités · Happy Place" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ActualitesRoute,
});

function ActualitesRoute() {
  const { role, email } = Route.useRouteContext();
  return <ActualitesPage role={role} email={email ?? ""} />;
}
