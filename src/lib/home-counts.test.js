import { describe, expect, mock, test } from "bun:test";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { computeAdminGaps, calculerDelaiValidation } = await import("./home-counts");

describe("admin gaps: teams without manager and users without team", () => {
  const teams = [
    { name: "Product", is_reserved: false },
    { name: "Data", is_reserved: false },
    { name: "Admin", is_reserved: true },
  ];
  const users = [
    {
      email: "a@x.fr",
      first_name: "Kesha",
      last_name: null,
      team: "Product",
      role: "manager",
      managedTeams: ["product"],
    },
    {
      email: "b@x.fr",
      first_name: "Nina",
      last_name: null,
      team: "Data",
      role: "collaborateur",
      managedTeams: [],
    },
    {
      email: "c@x.fr",
      first_name: "Gontran",
      last_name: null,
      team: "Data",
      role: "collaborateur",
      managedTeams: [],
    },
    {
      email: "d@x.fr",
      first_name: "Sans",
      last_name: null,
      team: null,
      role: "collaborateur",
      managedTeams: [],
    },
  ];

  test("a team counts as managed only with a manager role, matched ignoring case and edge spaces", () => {
    const gaps = computeAdminGaps({ teams, users });
    expect(gaps.teamsWithoutManager).toEqual([{ name: "Data", personnes: 2 }]);
  });

  test("reserved Admin team is never listed, users without team are counted", () => {
    const gaps = computeAdminGaps({ teams, users });
    expect(gaps.teamsWithoutManager.map((t) => t.name)).not.toContain("Admin");
    expect(gaps.usersWithoutTeam).toBe(1);
  });

  test("a person with a team and no role counts as a collaborator for the team gap", () => {
    const gaps = computeAdminGaps({
      teams: [{ name: "Product", is_reserved: false }],
      users: [
        {
          email: "e@x.fr",
          first_name: "Léa",
          last_name: null,
          team: "Product",
          role: null,
          managedTeams: [],
        },
      ],
    });
    expect(gaps.teamsWithoutManager).toEqual([{ name: "Product", personnes: 1 }]);
    expect(gaps.usersWithoutTeam).toBe(0);
  });
});

describe("délai de validation : la première décision termine le délai", () => {
  const JOUR = 86_400_000;
  const debut = Date.parse("2026-10-06T00:00:00Z");
  const le = (jour) => new Date(Date.parse("2026-10-01T00:00:00Z") + jour * JOUR).toISOString();

  test("une demande clarifiée puis validée compte jusqu'à la clarification (décision du 2026-11-03)", () => {
    const premiere = new Map([["a", le(8)]]); // clarification deux jours après la création ; la validation ultérieure n'est pas prise en compte
    const creation = new Map([["a", le(6)]]);
    expect(calculerDelaiValidation(premiere, creation, debut)).toEqual({ jours: 2, nb: 1 });
  });

  test("une demande seulement clarifiée sort du délai, comme une demande refusée", () => {
    const premiere = new Map([["a", le(7)]]);
    const creation = new Map([["a", le(6)]]);
    expect(calculerDelaiValidation(premiere, creation, debut)).toEqual({ jours: 1, nb: 1 });
  });

  test("moyenne sur les demandes décidées dans la fenêtre, une décimale", () => {
    const premiere = new Map([
      ["a", le(7)],
      ["b", le(9)],
    ]);
    const creation = new Map([
      ["a", le(6)],
      ["b", le(7)],
    ]);
    expect(calculerDelaiValidation(premiere, creation, debut)).toEqual({ jours: 1.5, nb: 2 });
  });

  test("décision avant la fenêtre, demande hors périmètre ou aucune donnée : pas de délai", () => {
    const avant = new Map([["a", le(2)]]);
    expect(calculerDelaiValidation(avant, new Map([["a", le(1)]]), debut)).toBeNull();
    expect(calculerDelaiValidation(new Map([["b", le(8)]]), new Map(), debut)).toBeNull();
    expect(calculerDelaiValidation(new Map(), new Map(), debut)).toBeNull();
  });
});
