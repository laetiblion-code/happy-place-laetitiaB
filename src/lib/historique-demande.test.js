import { describe, expect, mock, test } from "bun:test";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { lignesHistorique, reponsesClarification, decouperContenu, echangeClarification } = await import("@/lib/historique-demande");

const ligne = (id, extra) => ({
  id,
  submission_id: "s1",
  old_status: null,
  new_status: "en attente",
  changed_by_email: null,
  changed_by_name: null,
  is_automatic: false,
  rejection_category: null,
  rejection_note: null,
  changed_at: "2026-11-02T15:00:00Z",
  ...extra,
});

const KESHA = "kesha@example.test";
const GONTRAN = "gontran@example.test";
const noms = new Map([
  [KESHA, "Kesha Martin"],
  [GONTRAN, "Gontran Petit"],
]);

// Du plus récent au plus ancien, comme fetchSubmissionHistory
const rows = [
  ligne("h4", {
    old_status: "en attente",
    new_status: "validée",
    changed_by_email: KESHA,
    changed_at: "2026-11-02T16:00:00Z",
  }),
  ligne("h3", {
    old_status: "refusée",
    changed_by_email: GONTRAN,
    changed_at: "2026-11-02T15:30:00Z",
  }),
  ligne("h2", {
    old_status: "en attente",
    new_status: "refusée",
    rejection_category: "à clarifier",
    rejection_note: "Peux-tu préciser ?",
    changed_by_email: KESHA,
    changed_at: "2026-11-02T15:20:00Z",
  }),
  ligne("h1", { changed_by_email: GONTRAN }),
];
const contenu = "Peut-on avoir un outil ?\n\nRéponse à la clarification : Un outil de ticketing";

describe("historique de demande : langage clair", () => {
  test("du plus récent au plus ancien, avec « toi » pour l'auteur et les prénoms", () => {
    const l = lignesHistorique(rows, {
      moi: GONTRAN,
      attenteChez: "Kesha et Sophie",
      contenu,
      noms,
    });
    expect(l.map((x) => x.titre)).toEqual([
      "Validée par Kesha",
      "Complétée par toi · en attente chez Kesha et Sophie",
      "Clarification demandée par Kesha",
      "Envoyée · en attente chez Kesha et Sophie",
    ]);
    expect(l[1].detail).toBe("Ta réponse : Un outil de ticketing");
    expect(l[2].detail).toBe("Question : Peux-tu préciser ?");
    expect(l[0].quand).toContain("02/11/2026");
  });

  test("sans « moi » (gestion) : noms complets", () => {
    const l = lignesHistorique(rows, { attenteChez: "Kesha et Sophie", contenu, noms });
    expect(l[1].titre).toBe("Complétée par Gontran Petit · en attente chez Kesha et Sophie");
    expect(l[1].detail).toBe("Réponse : Un outil de ticketing");
    expect(l[2].titre).toBe("Clarification demandée par Kesha Martin");
  });

  test("refus avec motif, et revalidation automatique", () => {
    const l = lignesHistorique(
      [
        ligne("a", {
          old_status: "validée",
          changed_at: "2026-11-02T17:00:00Z",
          is_automatic: true,
        }),
        ligne("b", {
          old_status: "en attente",
          new_status: "refusée",
          rejection_category: "doublon",
          rejection_note: "Déjà corrigé",
          changed_by_email: KESHA,
        }),
      ],
      { noms },
    );
    expect(l[0].titre).toBe("Repassée en attente (revalidation annuelle)");
    expect(l[1].titre).toBe("Refusée par Kesha Martin");
    expect(l[1].detail).toBe("Motif : doublon. Déjà corrigé");
  });

  test("côté collaborateur, une adresse sans nom connu n'apparaît jamais", () => {
    const l = lignesHistorique(
      [
        ligne("c", {
          old_status: "en attente",
          new_status: "validée",
          changed_by_email: "inconnu@example.test",
        }),
      ],
      {
        moi: GONTRAN,
        noms,
      },
    );
    expect(l[0].titre).toBe("Validée par un manager");
  });
});

describe("réponses aux clarifications", () => {
  test("lit chaque réponse dans l'ordre", () => {
    expect(
      reponsesClarification(
        `Texte\n\nRéponse à la clarification : Un\n\nRéponse à la clarification : Deux`,
      ),
    ).toEqual(["Un", "Deux"]);
    expect(reponsesClarification("Sans réponse")).toEqual([]);
  });
});

describe("découpage du texte : demande, question et réponse", () => {
  test("une réponse : texte de la demande avant, réponse après", () => {
    expect(decouperContenu("Peut-on avoir un outil ?\n\nRéponse à la clarification : Un outil de ticketing")).toEqual({
      texte: "Peut-on avoir un outil ?",
      reponse: "Un outil de ticketing",
    });
  });

  test("plusieurs allers-retours : texte sans réponses, dernière réponse seulement", () => {
    expect(
      decouperContenu("Demande\n\nRéponse à la clarification : R1\n\nRéponse à la clarification : R2"),
    ).toEqual({ texte: "Demande", reponse: "R2" });
  });

  test("sans réponse : tout est le texte de la demande", () => {
    expect(decouperContenu("Sans réponse")).toEqual({ texte: "Sans réponse", reponse: null });
  });

  test("question la plus récente de l'historique, réponse seulement si elle la suit", () => {
    const rows = [
      ligne("c2", { old_status: "refusée", new_status: "en attente", changed_by_email: GONTRAN, changed_at: "2026-11-02T16:00:00Z" }),
      ligne("q2", {
        old_status: "en attente",
        new_status: "refusée",
        rejection_category: "à clarifier",
        rejection_note: "Quels usages ?",
        changed_by_email: KESHA,
        changed_at: "2026-11-02T15:30:00Z",
      }),
      ligne("c1", { old_status: "refusée", new_status: "en attente", changed_by_email: GONTRAN, changed_at: "2026-11-02T15:00:00Z" }),
      ligne("q1", {
        old_status: "en attente",
        new_status: "refusée",
        rejection_category: "à clarifier",
        rejection_note: "Lequel ?",
        changed_by_email: KESHA,
        changed_at: "2026-11-02T14:00:00Z",
      }),
    ];
    const e = echangeClarification("Demande\n\nRéponse à la clarification : R1\n\nRéponse à la clarification : R2", rows);
    expect(e.texte).toBe("Demande");
    expect(e.question).toEqual({ email: KESHA, texte: "Quels usages ?", quand: "2026-11-02T15:30:00Z" });
    // R2 n'a pas été envoyée : la dernière réponse (16:00) suit la question (15:30), elle est affichée
    expect(e.reponse).toEqual({ texte: "R2", quand: "2026-11-02T16:00:00Z" });
  });

  test("nouvelle question après une réponse : la réponse précédente n'est plus affichée", () => {
    const rows = [
      ligne("q2", {
        old_status: "en attente",
        new_status: "refusée",
        rejection_category: "à clarifier",
        rejection_note: "Encore ?",
        changed_by_email: KESHA,
        changed_at: "2026-11-02T17:00:00Z",
      }),
      ligne("c1", { old_status: "refusée", new_status: "en attente", changed_by_email: GONTRAN, changed_at: "2026-11-02T15:00:00Z" }),
      ligne("q1", {
        old_status: "en attente",
        new_status: "refusée",
        rejection_category: "à clarifier",
        rejection_note: "Lequel ?",
        changed_by_email: KESHA,
        changed_at: "2026-11-02T14:00:00Z",
      }),
    ];
    const e = echangeClarification("Demande\n\nRéponse à la clarification : R1", rows);
    expect(e.question.texte).toBe("Encore ?");
    expect(e.reponse).toBeNull();
  });

  test("sans historique chargé : la question en attente vient de la demande elle-même", () => {
    const e = echangeClarification("Demande", [], { texte: "Lequel ?", quand: "2026-11-02T14:00:00Z" });
    expect(e.question).toEqual({ email: null, texte: "Lequel ?", quand: "2026-11-02T14:00:00Z" });
    expect(e.reponse).toBeNull();
  });
});
