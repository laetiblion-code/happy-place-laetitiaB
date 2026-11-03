import type { News } from "@/lib/dashboard";
import { nomAffiche } from "@/lib/noms";

/**
 * « Par Kesha » ; si un admin a publié à sa place : « Par Kesha, via Olivia (admin) ».
 * La mention de délégation est écrite par la base (delegated_by_email), jamais par le navigateur.
 */
export function AuteurActualite({
  news,
  noms,
}: {
  news: Pick<News, "author" | "delegated_by_email">;
  noms: Map<string, string> | undefined;
}) {
  return (
    <>
      {`Par ${nomAffiche(news.author ?? "", noms)}`}
      {news.delegated_by_email && (
        <>
          {", "}
          <span className="text-[#7E5353]">
            {`via ${nomAffiche(news.delegated_by_email, noms)} (admin)`}
          </span>
        </>
      )}
    </>
  );
}
