import { describe, expect, test } from "bun:test";
const { attenteDemande, listeFr, managersAnnuaire } = await import("@/lib/attente-demande");

const CLARIFIER = "à clarifier";
const demande = (extra) => ({
  id: "d1",
  author_name: "Gontran Dupont",
  team: "Product",
  submitted_by_email: "gontran@x.fr",
  status: "en attente",
  rejection_category: null,
  ...extra,
});
const annuaire = {
  teams: [],
  users: [
    {
      email: "kesha@x.fr",
      first_name: "Kesha",
      last_name: null,
      team: null,
      role: "manager",
      managedTeams: ["product"],
    },
    {
      email: "sophie@x.fr",
      first_name: "Sophie",
      last_name: null,
      team: null,
      role: "manager",
      managedTeams: ["Product"],
    },
    {
      email: "marc@x.fr",
      first_name: "Marc",
      last_name: null,
      team: null,
      role: "manager",
      managedTeams: ["Ventes"],
    },
  ],
};

describe("listeFr", () => {
  test("liste française", () => {
    expect(listeFr([])).toBe("");
    expect(listeFr(["Kesha"])).toBe("Kesha");
    expect(listeFr(["Kesha", "Sophie"])).toBe("Kesha et Sophie");
    expect(listeFr(["A", "B", "C"])).toBe("A, B et C");
  });
});

describe("managersAnnuaire", () => {
  test("managers de l'équipe, sans casse ni espace", () => {
    expect(managersAnnuaire(annuaire, " PRODUCT ")).toEqual(["Kesha", "Sophie"]);
    expect(managersAnnuaire(annuaire, "RH")).toEqual([]);
  });
});

describe("attenteDemande : admin", () => {
  const admin = { role: "admin", annuaire };
  test("en attente : les managers de l'équipe", () => {
    expect(attenteDemande(demande({}), admin)).toEqual({
      libelle: "En attente chez Kesha et Sophie",
      clarification: false,
    });
  });
  test("équipe sans manager : « chez toi »", () => {
    expect(attenteDemande(demande({ team: "RH" }), admin)?.libelle).toBe("En attente chez toi");
  });
  test("clarification : chez l'autrice (premier prénom)", () => {
    expect(
      attenteDemande(demande({ status: "refusée", rejection_category: CLARIFIER }), admin),
    ).toEqual({
      libelle: "À clarifier chez Gontran",
      clarification: true,
    });
  });
  test("annuaire pas encore chargé : pas de chip d'attente", () => {
    expect(attenteDemande(demande({}), { role: "admin", annuaire: undefined })).toBeNull();
  });
  test("validée et refusée : pas de chip d'attente", () => {
    expect(attenteDemande(demande({ status: "validée" }), admin)).toBeNull();
    expect(
      attenteDemande(demande({ status: "refusée", rejection_category: "doublon" }), admin),
    ).toBeNull();
  });
});

describe("attenteDemande : manager", () => {
  test("ses équipes : « chez toi » ; autres équipes : pas de chip", () => {
    const ctx = { role: "manager", equipesGerees: ["Product"] };
    expect(attenteDemande(demande({}), ctx)?.libelle).toBe("En attente chez toi");
    expect(attenteDemande(demande({ team: "Ventes" }), ctx)).toBeNull();
  });
  test("clarification : chez l'autrice, quelle que soit l'équipe", () => {
    const ctx = { role: "manager", equipesGerees: [] };
    expect(
      attenteDemande(demande({ status: "refusée", rejection_category: CLARIFIER }), ctx)?.libelle,
    ).toBe("À clarifier chez Gontran");
  });
});

describe("attenteDemande : collaborateur", () => {
  const managers = [
    { team: "Product", prenom: "Kesha", nom: "A" },
    { team: "Product", prenom: "Sophie", nom: "B" },
    { team: "Ventes", prenom: "Marc", nom: "C" },
  ];
  const ctx = { role: "collaborateur", moi: "gontran@x.fr", managers };
  test("ses demandes en attente : managers de son équipe", () => {
    expect(attenteDemande(demande({}), ctx)?.libelle).toBe("En attente chez Kesha et Sophie");
  });
  test("sa demande à clarifier : « À compléter par toi »", () => {
    expect(
      attenteDemande(demande({ status: "refusée", rejection_category: CLARIFIER }), ctx),
    ).toEqual({ libelle: "À compléter par toi", clarification: true });
  });
  test("demande d'un autre : chip de statut simple", () => {
    expect(attenteDemande(demande({ submitted_by_email: "autre@x.fr" }), ctx)).toBeNull();
  });
  test("managers pas encore chargés : pas de chip", () => {
    expect(attenteDemande(demande({}), { ...ctx, managers: undefined })).toBeNull();
  });
});
