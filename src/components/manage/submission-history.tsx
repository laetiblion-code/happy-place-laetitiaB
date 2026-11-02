import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchSubmissionHistory, libelleChangement } from "@/lib/dashboard";
import { nomAffiche, useNomsAffiches } from "@/lib/noms";

const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

export function SubmissionHistory({ submissionId }: { submissionId: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["submissions", "history", submissionId],
    queryFn: () => fetchSubmissionHistory(submissionId),
    enabled: open,
  });
  const noms = useNomsAffiches((q.data ?? []).map((h) => h.changed_by_email ?? "")).data;
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
          {q.data?.map((h, i) => {
            const auteur = h.is_automatic
              ? "Automatique"
              : h.changed_by_email
                ? nomAffiche(h.changed_by_email, noms)
                : (h.changed_by_name ?? "Non renseigné");
            return (
              <div key={h.id} className="text-sm">
                <p className="text-on-surface-variant">
                  <span className="font-bold text-primary">{fmt.format(new Date(h.changed_at))}</span>
                  {" · "}
                  {libelleChangement(h, q.data?.[i + 1])}
                  {" · "}
                  {auteur}
                </p>
                {h.new_status === "refusée" && h.rejection_category && (
                  <p className="text-error">
                    Motif : {h.rejection_category}
                    {h.rejection_note ? ` : ${h.rejection_note}` : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
