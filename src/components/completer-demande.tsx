import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Linkify } from "@/components/linkify";
import { BoutonAnnuler, Modal } from "@/components/manage/crud-ui";
import { buttonVariants } from "@/components/ui/button";
import { completerMaDemande, type Submission } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const REPONSE_MAX = 500;
const DEMANDE_MAX = 2000;
const CLASSE_CHAMP =
  "w-full min-h-11 rounded-[6px] border border-[#8A8A90] bg-card px-sm py-xs font-body-md text-on-surface focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60";
const CLASSE_LABEL =
  "block text-[13px] font-bold uppercase tracking-[0.04em] text-on-surface-variant";

/**
 * Fenêtre « Compléter ma demande » (auteur d'une demande « à clarifier ») : rappel de la question, réponse
 * obligatoire, texte de la demande modifiable. Pied fixe : Annuler et Envoyer ma réponse. Fermer après une
 * saisie demande confirmation (voir Modal).
 */
export function CompleterDemande({
  submission: s,
  demandeur,
  attente,
  onClose,
  onEnvoyee,
}: {
  submission: Submission;
  /** Prénom de la personne qui a demandé la clarification. */
  demandeur: string;
  /** Prénoms des managers de l'équipe, pour « en attente chez … ». */
  attente: string;
  onClose: () => void;
  onEnvoyee: () => void;
}) {
  const qc = useQueryClient();
  const idBase = useId();
  const [reponse, setReponse] = useState("");
  const [demande, setDemande] = useState(s.content);
  const [montrerErreurs, setMontrerErreurs] = useState(false);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const erreurReponse = !reponse.trim() ? "Écris ta réponse avant de l'envoyer." : undefined;
  const erreurDemande = !demande.trim() ? "Ta demande ne peut pas être vide." : undefined;
  const modifie = reponse !== "" || demande !== s.content;

  const envoi = useMutation({
    mutationFn: () => completerMaDemande({ id: s.id, reponse, contenu: demande }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["submissions"] });
      qc.invalidateQueries({ queryKey: ["home-counts"] });
      onEnvoyee();
    },
    onError: (e) => setErreurServeur((e as Error).message),
  });

  function envoyer() {
    if (envoi.isPending) return;
    setMontrerErreurs(true);
    setErreurServeur(null);
    if (erreurReponse || erreurDemande) return;
    envoi.mutate();
  }

  const idReponse = `${idBase}-reponse`;
  const idDemande = `${idBase}-demande`;

  return (
    <Modal
      title="Compléter ma demande"
      onClose={onClose}
      modifie={modifie}
      onSubmit={(e) => {
        e.preventDefault();
        envoyer();
      }}
      pied={
        <div className="flex flex-wrap items-center justify-end gap-xs">
          <BoutonAnnuler disabled={envoi.isPending} />
          <button type="submit" disabled={envoi.isPending} className={buttonVariants({ variant: "default" })}>
            {envoi.isPending ? "Envoi en cours…" : "Envoyer ma réponse"}
          </button>
        </div>
      }
    >
      <div className="space-y-md">
        <p className="text-[14px] text-[#68686D]">
          {`Ta réponse sera ajoutée à ta demande, qui repassera en attente chez ${attente}.`}
        </p>

        {erreurServeur && (
          <p role="alert" className="bg-[#F5D5D4] p-sm text-body-sm font-semibold text-[#28282D]">
            {erreurServeur}
          </p>
        )}

        <div className="border border-[#CDCDD1] bg-white p-sm text-body-sm text-on-surface wrap-anywhere">
          <p className="whitespace-pre-line">
            <strong>{`${demandeur} :`}</strong> « <Linkify text={s.rejection_note ?? ""} /> »
          </p>
        </div>

        <div className="space-y-xs">
          <div className="flex items-baseline justify-between gap-sm">
            <label htmlFor={idReponse} className={CLASSE_LABEL}>
              Ta réponse <span aria-hidden="true">*</span>
            </label>
            <span className="shrink-0 text-[13px] tabular-nums text-on-surface-variant">
              {`${reponse.length} / ${REPONSE_MAX}`}
            </span>
          </div>
          <textarea
            id={idReponse}
            name="reponse"
            rows={4}
            maxLength={REPONSE_MAX}
            value={reponse}
            disabled={envoi.isPending}
            aria-required="true"
            aria-invalid={(montrerErreurs && !!erreurReponse) || undefined}
            aria-describedby={montrerErreurs && erreurReponse ? `${idReponse}-erreur` : undefined}
            onChange={(e) => setReponse(e.target.value)}
            className={cn(
              CLASSE_CHAMP,
              "resize-y rounded-md p-sm",
              montrerErreurs && erreurReponse ? "border-[#A81E25]" : "",
            )}
          />
          {montrerErreurs && erreurReponse && (
            <p id={`${idReponse}-erreur`} className="flex items-start gap-xs text-[13px] text-[#A81E25]">
              {erreurReponse}
            </p>
          )}
        </div>

        <div className="space-y-xs">
          <div className="flex items-baseline justify-between gap-sm">
            <label htmlFor={idDemande} className={CLASSE_LABEL}>
              Ta demande
            </label>
            <span className="shrink-0 text-[13px] tabular-nums text-on-surface-variant">
              {`${demande.length} / ${DEMANDE_MAX}`}
            </span>
          </div>
          <textarea
            id={idDemande}
            name="demande"
            rows={5}
            maxLength={DEMANDE_MAX}
            value={demande}
            disabled={envoi.isPending}
            aria-invalid={(montrerErreurs && !!erreurDemande) || undefined}
            aria-describedby={montrerErreurs && erreurDemande ? `${idDemande}-erreur` : undefined}
            onChange={(e) => setDemande(e.target.value)}
            className={cn(
              CLASSE_CHAMP,
              "resize-y rounded-md p-sm",
              montrerErreurs && erreurDemande ? "border-[#A81E25]" : "",
            )}
          />
          {montrerErreurs && erreurDemande && (
            <p id={`${idDemande}-erreur`} className="flex items-start gap-xs text-[13px] text-[#A81E25]">
              {erreurDemande}
            </p>
          )}
        </div>

      </div>
    </Modal>
  );
}
