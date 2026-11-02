import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Linkify } from "@/components/linkify";
import { fetchSubmissionHistory } from "@/lib/dashboard";
import { lignesHistorique } from "@/lib/historique-demande";
import { useNomsAffiches } from "@/lib/noms";

/** Historique d'une demande (du plus récent au plus ancien). Partagé par « Mes demandes » et la gestion. */
export function useHistoriqueDemande(submissionId: string, enabled = true) {
  return useQuery({
    queryKey: ["submissions", "history", submissionId],
    queryFn: () => fetchSubmissionHistory(submissionId),
    enabled,
  });
}

/**
 * Historique repliable. Sans `moi` (gestion), les noms complets sont affichés ; avec `moi` (« Mes demandes »),
 * ses actions sont « toi » et les autres personnes apparaissent par leur prénom.
 */
export function SubmissionHistory({
  submissionId,
  moi,
  attenteChez,
  contenu,
}: {
  submissionId: string;
  moi?: string;
  attenteChez?: string;
  contenu?: string;
}) {
  const [open, setOpen] = useState(false);
  const q = useHistoriqueDemande(submissionId, open);
  const noms = useNomsAffiches((q.data ?? []).map((h) => h.changed_by_email ?? "")).data;
  const lignes = q.data ? lignesHistorique(q.data, { moi, attenteChez, contenu, noms }) : [];

  return (
    <div className="mt-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex min-h-11 items-center text-sm text-on-surface-variant underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {open ? "▾" : "▸"} Historique
      </button>
      {open && (
        <div className="mt-xs border-l border-outline-variant pl-sm space-y-xs">
          {q.isLoading && <p className="text-sm text-on-surface-variant">Chargement…</p>}
          {q.isError && <p className="text-sm text-error">Impossible de charger l'historique.</p>}
          {q.data?.length === 0 && (
            <p className="text-sm italic text-on-surface-variant">Aucun changement enregistré.</p>
          )}
          {lignes.map((l) => (
            <div key={l.id} className="text-sm">
              <p className="text-on-surface-variant">
                <span className="font-bold text-primary">{l.quand}</span>
                {` · ${l.titre}`}
              </p>
              {l.detail && (
                <p className="whitespace-pre-line text-on-surface wrap-anywhere">
                  <Linkify text={l.detail} />
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
