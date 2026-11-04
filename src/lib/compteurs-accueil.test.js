import { describe, expect, test } from "bun:test";
import {
  accord,
  attenteAncienne,
  brouillonsPourObjectif,
  detailAlertes,
  incitationPublication,
  libelleAttente,
  libelleBrouillons,
  libelleLienBrouillons,
  nomCourt,
  phraseRetard,
  suiteObjectif,
} from "./compteurs-accueil";
import { etatObjectif, OBJECTIFS_TRIMESTRE } from "./objectifs";

const JOUR = 86_400_000;
const MAINTENANT = Date.parse("2026-11-04T12:00:00Z");

describe("états d'objectif par rôle", () => {
  test("atteint : coche, texte distinct admin et manager", () => {
    expect(suiteObjectif("atteint", true)).toBe("on garde le rythme");
    expect(suiteObjectif("atteint", false)).toBe("garde le rythme");
  });

  test("presque atteint : cible, texte distinct admin et manager", () => {
    expect(suiteObjectif("presque", true)).toBe("on y est presque");
    expect(suiteObjectif("presque", false)).toBe("tu y es presque");
  });

  test("loin : drapeau, texte distinct admin et manager", () => {
    expect(suiteObjectif("non", true)).toBe("on peut le faire");
    expect(suiteObjectif("non", false)).toBe("tu peux le faire");
  });

  test("délai : 1,9 j atteint, 2,1 j presque (écart ≤ 10 %), 2,3 j loin", () => {
    const { delaiValidationJours } = OBJECTIFS_TRIMESTRE;
    expect(etatObjectif(1.9, delaiValidationJours, "plusBas")).toBe("atteint");
    expect(etatObjectif(2.1, delaiValidationJours, "plusBas")).toBe("presque");
    expect(etatObjectif(2.3, delaiValidationJours, "plusBas")).toBe("non");
  });

  test("taux d'actualités : 70 % atteint, 65 % presque, 50 % loin", () => {
    const { tauxPublicationActus } = OBJECTIFS_TRIMESTRE;
    expect(etatObjectif(70, tauxPublicationActus, "plusHaut")).toBe("atteint");
    expect(etatObjectif(65, tauxPublicationActus, "plusHaut")).toBe("presque");
    expect(etatObjectif(50, tauxPublicationActus, "plusHaut")).toBe("non");
  });
});

describe("phrase de retard", () => {
  test("sans retard : pas de phrase quand la demande a 3 jours ou moins", () => {
    // Exactement 3 jours : pas encore « plus de 3 jours »
    expect(attenteAncienne("2026-11-01T12:00:00Z", MAINTENANT)).toBe(null);
    expect(attenteAncienne("2026-11-02T12:00:00Z", MAINTENANT)).toBe(null);
  });

  test("avec retard : jours pleins au-delà de 3 jours", () => {
    expect(attenteAncienne("2026-10-27T12:00:00Z", MAINTENANT)).toBe(8);
    expect(attenteAncienne("2026-10-31T12:00:00Z", MAINTENANT)).toBe(4);
  });

  test("« Sofia B. attend depuis 8 jours » et singulier 1 jour", () => {
    expect(phraseRetard("Sofia B.", 8)).toEqual({
      debut: "Sofia B. attend depuis ",
      jours: "8 jours",
    });
    expect(phraseRetard("Sofia B.", 1)).toEqual({
      debut: "Sofia B. attend depuis ",
      jours: "1 jour",
    });
  });

  test("nom court : prénom et initiale, sinon début de l'adresse", () => {
    expect(nomCourt("Sofia Bernard")).toBe("Sofia B.");
    expect(nomCourt("Sofia")).toBe("Sofia");
    expect(nomCourt("sofia.b@exemple.fr")).toBe("sofia.b");
  });
});

describe("calcul des brouillons à publier", () => {
  test("objectif 70 % sur 10 commencées : 7 à atteindre, entier exact", () => {
    expect(brouillonsPourObjectif(0, 10, 70)).toBe(7);
  });

  test("arrondi supérieur : 15 publiées sur 25 commencées", () => {
    // 0,7 × 25 = 17,5 → 18 ; 18 − 15 = 3
    expect(brouillonsPourObjectif(15, 25, 70)).toBe(3);
  });

  test("objectif atteint : pas de phrase", () => {
    const r = incitationPublication({
      publiees: 7,
      commencees: 10,
      brouillons: 5,
      objectifPourcent: 70,
      admin: false,
    });
    expect(r.phrase).toBe(null);
  });

  test("publier suffit : « Publier 3 brouillons suffit pour atteindre l'objectif. »", () => {
    const r = incitationPublication({
      publiees: 15,
      commencees: 25,
      brouillons: 10,
      objectifPourcent: 70,
      admin: false,
    });
    expect(r).toEqual({
      phrase: "Publier 3 brouillons suffit pour atteindre l'objectif.",
      nombre: 3,
    });
  });

  test("x dépasse les brouillons : phrase manager et admin", () => {
    const base = { publiees: 0, commencees: 10, brouillons: 4, objectifPourcent: 70 };
    expect(incitationPublication({ ...base, admin: false })).toEqual({
      phrase: "Publier tes 4 brouillons te rapproche de l'objectif.",
      nombre: 4,
    });
    expect(incitationPublication({ ...base, admin: true })).toEqual({
      phrase: "Publier les 4 brouillons nous rapproche de l'objectif.",
      nombre: 4,
    });
  });

  test("singulier : un seul brouillon qui suffit ou non", () => {
    const suffit = incitationPublication({
      publiees: 6,
      commencees: 10,
      brouillons: 3,
      objectifPourcent: 70,
      admin: false,
    });
    expect(suffit).toEqual({
      phrase: "Publier 1 brouillon suffit pour atteindre l'objectif.",
      nombre: 1,
    });
    const pasAssez = incitationPublication({
      publiees: 0,
      commencees: 10,
      brouillons: 1,
      objectifPourcent: 70,
      admin: false,
    });
    expect(pasAssez).toEqual({
      phrase: "Publier ton brouillon te rapproche de l'objectif.",
      nombre: 1,
    });
  });

  test("sans brouillon : aucune phrase", () => {
    const r = incitationPublication({
      publiees: 0,
      commencees: 10,
      brouillons: 0,
      objectifPourcent: 70,
      admin: true,
    });
    expect(r.phrase).toBe(null);
  });

  test("libellés du lien : singulier et pluriel, admin et manager", () => {
    expect(libelleLienBrouillons(3, false)).toBe("Je publie mes 3 brouillons");
    expect(libelleLienBrouillons(3, true)).toBe("Je publie les 3 brouillons");
    expect(libelleLienBrouillons(1, false)).toBe("Je publie mon brouillon");
    expect(libelleLienBrouillons(1, true)).toBe("Je publie le brouillon");
  });
});

describe("singuliers des grands libellés", () => {
  test("demandes : 0, 1, plusieurs", () => {
    expect(libelleAttente(0)).toEqual({ chiffre: false, texte: "Rien n'attend ta décision" });
    expect(libelleAttente(1)).toEqual({ chiffre: true, texte: "attend ta décision" });
    expect(libelleAttente(3)).toEqual({ chiffre: true, texte: "attendent ta décision" });
  });

  test("brouillons et accord général", () => {
    expect(libelleBrouillons(1)).toBe("brouillon");
    expect(libelleBrouillons(10)).toBe("brouillons");
    expect(accord(0, "alerte", "alertes")).toBe("alerte");
  });

  test("détail des alertes, sans les catégories vides", () => {
    expect(detailAlertes({ ouverte: 1, enCours: 2, surveillance: 2 })).toEqual([
      "1 ouverte",
      "2 en cours",
      "2 sous surveillance",
    ]);
    expect(detailAlertes({ ouverte: 0, enCours: 1, surveillance: 0 })).toEqual(["1 en cours"]);
  });
});
