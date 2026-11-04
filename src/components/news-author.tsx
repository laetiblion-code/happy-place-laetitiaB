import type { News } from "@/lib/dashboard";
import { nomAuteurActualite } from "@/lib/noms";
import { useEstAdmin } from "@/hooks/use-est-admin";

/**
 * « Par Kesha » ; si un admin a publié à sa place : « Par Kesha, via Olivia (admin) ».
 * Sans nom connu, une adresse n'est montrée qu'à l'admin : « Par un manager », « via l'administration ».
 * La mention de délégation est écrite par la base (delegated_by_email), jamais par le navigateur.
 */
export function AuteurActualite({
  news,
  noms,
}: {
  news: Pick<News, "author" | "delegated_by_email">;
  noms: Map<string, string> | undefined;
}) {
  const admin = useEstAdmin();
  const auteur = nomAuteurActualite(news.author ?? "", noms, admin);
  const delegant = news.delegated_by_email
    ? nomAuteurActualite(news.delegated_by_email, noms, admin, true)
    : null;
  return (
    <>
      {`Par ${auteur}`}
      {delegant && (
        <>
          {", "}
          <span className="text-[#7E5353]">
            {delegant === "l'administration" ? "via l'administration" : `via ${delegant} (admin)`}
          </span>
        </>
      )}
    </>
  );
}
