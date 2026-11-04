import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { linkDisplay, signedNewsImageUrl, type NewsLink } from "@/lib/news-media";

function I({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

export function NewsImage({
  path,
  alt,
  className = "",
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const q = useQuery({
    queryKey: ["news-image", path],
    queryFn: () => signedNewsImageUrl(path),
    staleTime: 50 * 60 * 1000,
    retry: false,
  });
  if (!q.data) return null;
  return (
    <img
      src={q.data}
      alt={alt}
      className={cn("w-full max-h-60 object-cover border border-outline-variant", className)}
    />
  );
}

/**
 * Vignette carrée de 72 px dans les listes : recadrage centré, coins arrondis de 6 px.
 * Texte alternatif : le titre de l'actualité. Rien à afficher sans image (pas d'espace réservé).
 */
export function NewsVignette({
  path,
  alt,
  taille = "normale",
}: {
  path: string;
  alt: string;
  /** « petite » : 56 px, pour les lignes d'actualités publiées ; « normale » : 72 px (brouillons). */
  taille?: "normale" | "petite";
}) {
  const q = useQuery({
    queryKey: ["news-image", path],
    queryFn: () => signedNewsImageUrl(path),
    staleTime: 50 * 60 * 1000,
    retry: false,
  });
  if (!q.data) return null;
  return (
    <img
      src={q.data}
      alt={alt}
      className={`${taille === "petite" ? "size-14" : "size-[72px]"} shrink-0 rounded-[6px] border border-outline-variant object-cover object-center`}
    />
  );
}

export function NewsLinks({ links }: { links: unknown }) {
  const list = Array.isArray(links) ? (links as NewsLink[]) : [];
  if (!list.length) return null;
  return (
    <ul className="space-y-1 min-w-0">
      {list.map((l, i) => (
        <li key={i} className="min-w-0">
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-start gap-1 max-w-full text-primary font-body-sm text-body-sm wrap-anywhere"
          >
            <span className="wrap-anywhere underline underline-offset-2">{linkDisplay(l)}</span>
            <I name="open_in_new" className="text-sm shrink-0" />
          </a>
        </li>
      ))}
    </ul>
  );
}
