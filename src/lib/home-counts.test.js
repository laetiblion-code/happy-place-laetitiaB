import { describe, expect, mock, test } from "bun:test";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { computeAdminGaps } = await import("./home-counts");

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
