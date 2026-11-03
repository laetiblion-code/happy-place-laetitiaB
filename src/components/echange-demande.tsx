import { Linkify } from "@/components/linkify";
import { useHistoriqueDemande } from "@/components/manage/submission-history";
import { CLARIFY_CATEGORY } from "@/components/status-badge";
import { echangeClarification, MARQUEUR_REPONSE, type Echange } from "@/lib/historique-demande";
import type { Submission } from "@/lib/dashboard";
import { nomAffiche, prenomOuRien, useNomsAffiches } from "@/lib/noms";

export type EchangeAffiche = {
  texte: string;
  question: { nom: string; texte: string; quand: string } | null;
  reponse: { nom: string; texte: string; quand: string } | null;
};

/**
 * Texte de la demande et échange de clarification, lus dans l'historique et le texte enregistré.
 * `moi` : adresse de la personne connectée (« Toi »). Côté auteur, le manager sans nom connu est « Ton manager » ;
 * côté manager, « Un manager ».
 */
export function useEchangeDemande(s: Submission, moi: string): EchangeAffiche {
  const clarification = s.status === "refusée" && s.rejection_category === CLARIFY_CATEGORY;
  const aReponse = s.content.includes(MARQUEUR_REPONSE);
  const historique = useHistoriqueDemande(s.id, clarification || aReponse);
  const brut: Echange = echangeClarification(
    s.content,
    historique.data ?? [],
    // Pendant le chargement de l'historique, la question en attente est celle de la demande elle-même
    clarification ? { texte: s.rejection_note ?? "", quand: s.created_at } : undefined,
  );
  const noms = useNomsAffiches([brut.question?.email ?? ""]).data;

  const moiMin = moi.toLowerCase();
  const estAuteur = (s.submitted_by_email ?? "").toLowerCase() === moiMin;
  const repli = estAuteur ? "Ton manager" : "Un manager";
  const questionEmail = brut.question?.email?.toLowerCase() ?? null;

  const nomQuestion = !questionEmail
    ? repli
    : questionEmail === moiMin
      ? "Toi"
      : (prenomOuRien(nomAffiche(questionEmail, noms)) ?? repli);
  const nomReponse = estAuteur ? "Toi" : (prenomOuRien(s.author_name) ?? "Le collaborateur");

  return {
    texte: brut.texte,
    question: brut.question
      ? { nom: nomQuestion, texte: brut.question.texte, quand: brut.question.quand }
      : null,
    reponse: brut.reponse
      ? { nom: nomReponse, texte: brut.reponse.texte, quand: brut.reponse.quand }
      : null,
  };
}

/** Encadré blanc bordé : la question, puis la réponse, chacune sur sa ligne. Rien s'il n'y a pas d'échange. */
export function EchangeDemande({ echange }: { echange: EchangeAffiche }) {
  if (!echange.question && !echange.reponse) return null;
  return (
    <div className="space-y-xs border border-[#CDCDD1] bg-white p-sm text-body-sm text-on-surface wrap-anywhere">
      {echange.question && (
        <p className="whitespace-pre-line">
          <strong>{`${echange.question.nom} :`}</strong> «{" "}
          <em>
            <Linkify text={echange.question.texte} />
          </em>{" "}
          »
        </p>
      )}
      {echange.reponse && (
        <p className="whitespace-pre-line">
          <strong>{`${echange.reponse.nom} :`}</strong> «{" "}
          <em>
            <Linkify text={echange.reponse.texte} />
          </em>{" "}
          »
        </p>
      )}
    </div>
  );
}

/** Texte de la demande (sans les réponses) suivi de l'échange de clarification, pour le lecteur et « Demandes à traiter ». */
export function TexteDemande({
  s,
  moi,
  className = "",
}: {
  s: Submission;
  moi: string;
  className?: string;
}) {
  const echange = useEchangeDemande(s, moi);
  return (
    <div className={`space-y-sm ${className}`}>
      <p className="whitespace-pre-line font-body-md text-on-surface wrap-anywhere">{`« ${echange.texte} »`}</p>
      <EchangeDemande echange={echange} />
    </div>
  );
}
