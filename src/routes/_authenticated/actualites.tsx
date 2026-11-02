import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SessionHeader } from "@/components/session-header";
import { NewsReader } from "@/components/news-reader";
import { NewsImage, NewsLinks } from "@/components/news-media";
import { buttonVariants } from "@/components/ui/button";
import { fetchNews, timeAgo, type News } from "@/lib/dashboard";
import { nomAffiche, useNomsAffiches } from "@/lib/noms";

export const Route = createFileRoute("/_authenticated/actualites")({
  head: () => ({
    meta: [
      { title: "Actualités · Happy Place" },
      { name: "description", content: "Toutes les actualités publiées du cabinet." },
      { property: "og:title", content: "Actualités · Happy Place" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ActualitesPage,
});

/** Nombre d'actualités affichées au premier chargement, puis par tranche. */
const TAILLE_PAGE = 10;

function ActualitesPage() {
  const news = useQuery({ queryKey: ["news"], queryFn: fetchNews, retry: false });
  const publiees = news.data?.filter((n) => n.status === "publiée") ?? [];
  const noms = useNomsAffiches(publiees.map((n) => n.author ?? "")).data;
  const [affichees, setAffichees] = useState(TAILLE_PAGE);
  const [lu, setLu] = useState<News | null>(null);
  // Index de la première actualité ajoutée : le focus y est placé après « Afficher 10 de plus »
  const [focusSur, setFocusSur] = useState<number | null>(null);

  useEffect(() => {
    if (focusSur === null) return;
    document.getElementById(`actualite-${focusSur}`)?.focus();
    setFocusSur(null);
  }, [focusSur]);

  const visibles = publiees.slice(0, affichees);

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen">
      <SessionHeader />
      <main id="contenu" className="w-full max-w-interface mx-auto p-sm md:p-md space-y-md">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-sm">
          <h1 className="font-headline-lg text-headline-lg text-primary">Actualités</h1>
          <Link to="/" className={buttonVariants({ variant: "secondary" })}>
            ← Retour à l'accueil
          </Link>
        </div>

        {news.isLoading && <p className="text-body-sm text-on-surface-variant">Chargement…</p>}
        {news.isError && (
          <p className="text-body-sm text-error">Les actualités sont indisponibles.</p>
        )}
        {news.isSuccess && publiees.length === 0 && (
          <p className="text-body-sm italic text-on-surface-variant">
            Aucune actualité publiée pour le moment.
          </p>
        )}

        <ul className="space-y-xs">
          {visibles.map((n, i) => (
            <li key={n.id} className="rounded-md bg-surface-container p-sm space-y-xs min-w-0">
              <button
                type="button"
                id={`actualite-${i}`}
                onClick={() => setLu(n)}
                aria-haspopup="dialog"
                className="w-full text-left group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {n.image_path && <NewsImage path={n.image_path} alt={n.title} />}
                <span className="block font-body-md text-primary group-hover:underline wrap-anywhere">
                  {n.title}
                </span>
                <span className="block text-xs text-on-surface-variant uppercase font-label-sm">
                  Publiée {timeAgo(n.created_at)} • Par {nomAffiche(n.author ?? "", noms)}
                </span>
              </button>
              <NewsLinks links={n.links} />
            </li>
          ))}
        </ul>

        {affichees < publiees.length && (
          <button
            type="button"
            onClick={() => {
              setFocusSur(affichees);
              setAffichees((n) => n + TAILLE_PAGE);
            }}
            className={buttonVariants({ variant: "secondary" })}
          >
            Afficher {Math.min(TAILLE_PAGE, publiees.length - affichees)} de plus
          </button>
        )}
      </main>
      <NewsReader news={lu} onClose={() => setLu(null)} />
    </div>
  );
}
