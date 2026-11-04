import { describe, expect, mock, test } from "bun:test";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { nomAuteurActualite } = await import("@/lib/noms");
const { lignesHistorique, attenteDeEquipe } = await import("@/lib/historique-demande");
const { correspondFiltre } = await import("@/components/filtres-demandes");

const base = {
  id: "h1",
  submission_id: "s1",
  old_status: null,
  new_status: "en attente",
  changed_by_email: null,
  changed_by_name: null,
  is_automatic: false,
  rejection_category: null,
  rejection_note: null,
  changed_at: "2026-11-03T00:10:00Z",
};

describe("auteur d'une actualité sans nom", () => {
  const noms = new Map([["olivia@example.test", "Olivia Bauducel"]]);

  test("un collaborateur ne voit jamais l'adresse : « un manager » sans nom", () => {
    expect(nomAuteurActualite("kesha@example.test", noms, false)).toBe("un manager");
  });

  test("délégation sans nom : « l'administration »", () => {
    expect(nomAuteurActualite("admin@example.test", noms, false, true)).toBe("l'administration");
  });

  test("le nom connu l'emporte, et l'admin voit l'adresse quand il n'y a pas de nom", () => {
    expect(nomAuteurActualite("olivia@example.test", noms, false)).toBe("Olivia Bauducel");
    expect(nomAuteurActualite("kesha@example.test", noms, true)).toBe("kesha@example.test");
  });
});

describe("historique : où la demande attend", () => {
  test("demande d'un manager ou d'un admin validée à l'envoi", () => {
    const [l] = lignesHistorique([{ ...base, new_status: "validée" }], {});
    expect(l.titre).toBe("Envoyée · validée à l'envoi");
  });

  test("création : « en attente chez » avec les noms de l'équipe", () => {
    const [l] = lignesHistorique([base], { attenteChez: "Kesha Martin et Sophie Marchand", noms: undefined });
    expect(l.titre).toBe("Envoyée · en attente chez Kesha Martin et Sophie Marchand");
  });

  test("revalidation automatique : « Repassée en attente chez … »", () => {
    const [l] = lignesHistorique(
      [{ ...base, old_status: "validée", new_status: "en attente", is_automatic: true }],
      { attenteChez: "l'admin", noms: undefined },
    );
    expect(l.titre).toBe("Repassée en attente chez l'admin (revalidation annuelle)");
  });
});

describe("attente par équipe (gestion)", () => {
  const annuaire = {
    teams: [{ name: "Data", is_reserved: false }, { name: "Product", is_reserved: false }],
    users: [
      { email: "kesha@example.test", first_name: "Kesha", last_name: "Martin", team: "Data", role: "manager", managedTeams: ["Data"] },
      { email: "sophie@example.test", first_name: "Sophie", last_name: "Marchand", team: "Data", role: "manager", managedTeams: ["data"] },
    ],
  };

  test("plusieurs managers : prénoms et noms joints", () => {
    expect(attenteDeEquipe("Data", annuaire)).toBe("Kesha Martin et Sophie Marchand");
  });

  test("équipe sans manager : « l'admin »", () => {
    expect(attenteDeEquipe("Product", annuaire)).toBe("l'admin");
  });

  test("annuaire pas encore chargé : rien", () => {
    expect(attenteDeEquipe("Data", undefined)).toBeUndefined();
  });
});

describe("filtres des demandes", () => {
  const maintenant = Date.parse("2026-11-04T12:00:00Z");
  const demande = {
    id: "d1",
    status: "en attente",
    rejection_category: null,
    created_at: "2026-10-30T12:00:00Z",
    submitted_by_email: "kesha@example.test",
    attachment_path: null,
  };

  test("« En retard » : en attente depuis plus de 3 jours", () => {
    expect(correspondFiltre(demande, "retard", "moi@example.test", maintenant)).toBe(true);
    expect(correspondFiltre({ ...demande, created_at: "2026-11-03T12:00:00Z" }, "retard", "moi@example.test", maintenant)).toBe(false);
  });

  test("« Mes demandes » compare l'adresse en minuscules", () => {
    expect(correspondFiltre(demande, "mes", "kesha@example.test", maintenant)).toBe(true);
    expect(correspondFiltre(demande, "mes", "autre@example.test", maintenant)).toBe(false);
  });
});
