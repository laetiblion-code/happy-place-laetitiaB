import { expect, test, type Page } from "@playwright/test";
import { ouvrirEnTantQue } from "./support/session-simulee";

// Demandes simulées : deux en attente de plus de 3 jours (dont une à clarifier), une récente, une traitée.
const il = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString();
const demande = (
  id: string,
  auteur: string,
  equipe: string,
  statut: string,
  jours: number,
  extra = {},
) => ({
  id,
  author_name: auteur,
  team: equipe,
  content:
    "Pourquoi les départs à venir ne montrent-ils pas les documents requis pour les collaborateurs en contrat court durée et en mission ?",
  status: statut,
  created_at: il(jours),
  submitted_by_email: `${id}@example.com`,
  category: "question",
  visibility: "équipe",
  attachment_path: null,
  attachment_name: null,
  rejection_category: null,
  rejection_note: null,
  ...extra,
});

const DEMANDES = [
  demande("a", "Olivia Bauducel", "Product", "en attente", 5),
  demande(
    "b",
    "Marie-Hélène de Saint-Exupéry-Dubois",
    "Ressources humaines et communication interne",
    "validée",
    1,
  ),
  demande("c", "Kesha Ndiaye", "Data", "en attente", 4, { category: "problème" }),
  demande("d", "Théo Lambert", "Design produit", "refusée", 6, {
    rejection_category: "à clarifier",
  }),
  demande("e", "Nina Petit", "Design produit", "en attente", 1, { visibility: "entreprise" }),
];

const LARGEURS = [1440, 1280, 1100, 1024, 900, 768, 700, 600, 375];

/** Débordement du tableau hors de sa carte, et débordement de la page entière (en pixels, 0 = aucun). */
async function mesurerDebordement(page: Page) {
  return page.evaluate(() => {
    const table = document.querySelector<HTMLElement>(
      '[role="table"][aria-label^="Dix dernières"]',
    );
    if (!table) throw new Error("Tableau introuvable");
    const carte = table.closest("section") as HTMLElement;
    const style = getComputedStyle(carte);
    const bordDroit =
      carte.getBoundingClientRect().right -
      parseFloat(style.borderRightWidth) -
      parseFloat(style.paddingRight);
    const horsCarte = [...table.querySelectorAll<HTMLElement>("*")]
      .filter(
        (el) =>
          el.getBoundingClientRect().width > 0 &&
          el.getBoundingClientRect().right > bordDroit + 0.5,
      )
      .map(
        (el) => `${el.tagName.toLowerCase()} (${Math.round(el.getBoundingClientRect().right)} px)`,
      );
    const html = document.documentElement;
    return {
      tableauHorsCarte: horsCarte.slice(0, 5),
      pageDebordement: html.scrollWidth - html.clientWidth,
    };
  });
}

test.describe("tableau « 10 dernières demandes » : mise en page responsive", () => {
  for (const largeur of LARGEURS) {
    test(`à ${largeur} px : rien ne sort de la carte et la page ne défile pas en largeur`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await ouvrirEnTantQue(page, "admin", "/", { demandes: DEMANDES });
      await expect(page.getByRole("table", { name: /Dix dernières demandes/ })).toBeVisible();
      await page.waitForLoadState("networkidle");

      const mesure = await mesurerDebordement(page);
      expect(mesure.tableauHorsCarte, "éléments qui sortent de la carte").toEqual([]);
      expect(mesure.pageDebordement, "défilement horizontal de la page").toBeLessThanOrEqual(0);
    });
  }

  test("à 1100 px, les cinq colonnes sont visibles ; à 375 px, les demandes sont en cartes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await ouvrirEnTantQue(page, "admin", "/", { demandes: DEMANDES });
    const tableau = page.getByRole("table", { name: /Dix dernières demandes/ });
    await expect(tableau).toBeVisible();
    for (const colonne of ["Catégorie", "Auteur et demande", "Statut", "Visibilité", "Date"]) {
      await expect(tableau.getByRole("columnheader", { name: colonne })).toBeVisible();
    }

    await page.setViewportSize({ width: 375, height: 900 });
    await expect(tableau.getByRole("columnheader", { name: "Statut" })).toBeHidden();
  });

  for (const largeur of [1440, 1100]) {
    test(`à ${largeur} px, la colonne « Auteur et demande » est alignée sur toutes les lignes`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await ouvrirEnTantQue(page, "admin", "/", { demandes: DEMANDES });
      const tableau = page.getByRole("table", { name: /Dix dernières demandes/ });
      await expect(tableau).toBeVisible();
      // Dans chaque ligne (en-tête compris), la deuxième cellule est « Auteur et demande »
      const gauches = await tableau.getByRole("row").evaluateAll((lignes) =>
        lignes.map((ligne) => {
          const cellules = ligne.querySelectorAll<HTMLElement>('[role="columnheader"], [role="cell"]');
          return Math.round(cellules[1].getBoundingClientRect().left);
        }),
      );
      expect(gauches.length).toBeGreaterThan(2);
      expect(new Set(gauches).size).toBe(1);
    });
  }
});

test.describe("filtre « En retard (+3 j) »", () => {
  test("le manager et l'admin voient le filtre ; il garde les demandes en attente depuis plus de 3 jours", async ({
    page,
  }) => {
    await ouvrirEnTantQue(page, "admin", "/", { demandes: DEMANDES });
    const tableau = page.getByRole("table", { name: /Dix dernières demandes/ });
    await expect(tableau).toBeVisible();

    const filtre = page.getByRole("button", { name: "En retard (+3 j)" });
    await expect(filtre).toHaveAttribute("aria-pressed", "false");
    await filtre.click();
    await expect(filtre).toHaveAttribute("aria-pressed", "true");

    // En-tête + Olivia (5 j, en attente), Kesha (4 j, en attente), Théo (6 j, à clarifier)
    await expect(tableau.getByRole("row")).toHaveCount(4);
    await expect(tableau.getByText("Olivia Bauducel")).toBeVisible();
    await expect(tableau.getByText("Théo Lambert")).toBeVisible();
    await expect(tableau.getByText("Nina Petit")).toHaveCount(0);
  });

  test("sans demande en retard : « Aucune demande en retard. »", async ({ page }) => {
    await ouvrirEnTantQue(page, "manager", "/", {
      demandes: [demande("f", "Nina Petit", "Design produit", "en attente", 1)],
    });
    await expect(page.getByRole("table", { name: /Dix dernières demandes/ })).toBeVisible();
    await page.getByRole("button", { name: "En retard (+3 j)" }).click();
    await expect(page.getByText("Aucune demande en retard.")).toBeVisible();
  });

  test("le collaborateur ne voit pas le filtre", async ({ page }) => {
    await ouvrirEnTantQue(page, "collaborateur", "/", { demandes: DEMANDES });
    await expect(page.getByRole("table", { name: /Dix dernières demandes/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "En retard (+3 j)" })).toHaveCount(0);
  });
});
