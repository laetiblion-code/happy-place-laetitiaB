import { expect, test, type Page } from "@playwright/test";
import { ouvrirEnTantQue } from "./support/session-simulee";

// Demandes simulées : catégorie « question » par défaut ; deux en attente de plus de 3 jours, une récente, une traitée.
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
    {
      category: "amélioration de Happy Place",
      visibility: "entreprise",
    },
  ),
  demande("c", "Kesha Ndiaye", "Data", "en attente", 4, { category: "problème" }),
  demande("d", "Théo Lambert", "Design produit", "refusée", 6, {
    rejection_category: "à clarifier",
  }),
  demande("e", "Nina Petit", "Design produit", "en attente", 1, {
    visibility: "entreprise",
    category: "idée",
  }),
];

const LARGEURS = [1440, 1100, 768, 375];

/** Déborde-t-il ? (en pixels, 0 = aucun) : défilement horizontal de la page, et cartes hors de leur bloc. */
async function mesurerDebordement(page: Page) {
  return page.evaluate(() => {
    const horsBloc = [...document.querySelectorAll<HTMLElement>('article[id^="carte-"]')].filter(
      (carte) => {
        const bloc = carte.closest("section") as HTMLElement;
        return carte.getBoundingClientRect().right > bloc.getBoundingClientRect().right + 0.5;
      },
    ).length;
    const html = document.documentElement;
    return { cartesHorsBloc: horsBloc, pageDebordement: html.scrollWidth - html.clientWidth };
  });
}

/** Nombre de colonnes des blocs : nombre de positions horizontales distinctes sur la première ligne. */
async function colonnesDeBlocs(page: Page) {
  return page.evaluate(() => {
    const blocs = [
      ...document.querySelectorAll<HTMLElement>('section[aria-labelledby^="titre-bloc-"]'),
    ];
    const premiereLigne = blocs.filter(
      (b) => Math.abs(b.getBoundingClientRect().top - blocs[0].getBoundingClientRect().top) < 2,
    );
    const largeur = document
      .querySelector('section[aria-labelledby="titre-cabinet"]')!
      .getBoundingClientRect().width;
    return { blocs: blocs.length, colonnes: premiereLigne.length, largeur: Math.round(largeur) };
  });
}

test.describe("blocs « Demandes du cabinet » : mise en page responsive", () => {
  for (const largeur of LARGEURS) {
    test(`à ${largeur} px : rien ne déborde et les blocs passent en ${largeur >= 640 ? 2 : 1} colonne(s)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await ouvrirEnTantQue(page, "admin", "/", { demandes: DEMANDES });
      await expect(page.getByRole("heading", { name: "Boîte à idées" })).toBeVisible();
      await page.waitForLoadState("networkidle");

      const mesure = await mesurerDebordement(page);
      expect(mesure.cartesHorsBloc, "cartes qui sortent de leur bloc").toBe(0);
      expect(mesure.pageDebordement, "défilement horizontal de la page").toBeLessThanOrEqual(0);

      // Les seuils portent sur la largeur du bloc (requête de conteneur), pas sur la fenêtre
      const colonnes = await colonnesDeBlocs(page);
      // Deux colonnes dès 640 px de large, une en dessous (les quatre blocs restent dans cet ordre)
      const attendu = colonnes.largeur >= 640 ? 2 : 1;
      expect(colonnes.blocs).toBe(4);
      expect(colonnes.colonnes, `largeur du bloc : ${colonnes.largeur} px`).toBe(attendu);
    });
  }
});

test.describe("blocs par type", () => {
  test("chaque demande est rangée dans son bloc ; « Voir tout » au-delà de 3 cartes", async ({
    page,
  }) => {
    await ouvrirEnTantQue(page, "admin", "/", { demandes: DEMANDES });
    const questions = page.locator('section[aria-labelledby="titre-bloc-question"]');
    // Questions : Olivia, Théo, Nina ? non (Nina est une idée) : a, d, b est amélioration → 2 questions
    await expect(questions.getByRole("img", { name: "2 demandes" })).toBeVisible();
    await expect(page.getByRole("img", { name: "1 demande" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Voir tout (4)" })).toHaveCount(0);
  });

  test("plus de 3 demandes dans un bloc : « Voir tout (N) » vers /demandes?type=…", async ({
    page,
  }) => {
    const beaucoup = ["p", "q", "r", "s"].map((id, i) =>
      demande(id, `Auteur ${i}`, "Data", "validée", i + 2),
    );
    await ouvrirEnTantQue(page, "manager", "/", { demandes: beaucoup });
    const lien = page.getByRole("link", { name: "Voir tout (4)" });
    await expect(lien).toHaveAttribute("href", "/demandes?type=question");
  });

  test("le manager et l'admin voient le filtre ; il garde les demandes en attente depuis plus de 3 jours", async ({
    page,
  }) => {
    await ouvrirEnTantQue(page, "admin", "/", { demandes: DEMANDES });
    const filtre = page.getByRole("button", { name: "En retard (+3 j)" });
    await expect(filtre).toHaveAttribute("aria-pressed", "false");
    await filtre.click();
    await expect(filtre).toHaveAttribute("aria-pressed", "true");

    // Olivia (5 j, en attente), Kesha (4 j, en attente), Théo (6 j, à clarifier)
    await expect(page.getByRole("article")).toHaveCount(3);
    await expect(page.getByRole("article").filter({ hasText: "Olivia Bauducel" })).toHaveCount(1);
    await expect(page.getByRole("article").filter({ hasText: "Théo Lambert" })).toHaveCount(1);
    await expect(page.getByRole("article").filter({ hasText: "Nina Petit" })).toHaveCount(0);
  });

  test("sans demande en retard : « Aucune demande en retard. »", async ({ page }) => {
    await ouvrirEnTantQue(page, "manager", "/", {
      demandes: [demande("f", "Nina Petit", "Design produit", "en attente", 1)],
    });
    await expect(page.getByRole("heading", { name: "Boîte à idées" })).toBeVisible();
    await page.getByRole("button", { name: "En retard (+3 j)" }).click();
    await expect(page.getByText("Aucune demande en retard.")).toBeVisible();
  });

  test("le collaborateur ne voit pas le filtre", async ({ page }) => {
    await ouvrirEnTantQue(page, "collaborateur", "/", { demandes: DEMANDES });
    await expect(page.getByRole("heading", { name: "Boîte à idées" })).toBeVisible();
    await expect(page.getByRole("button", { name: "En retard (+3 j)" })).toHaveCount(0);
  });

  test("la carte d'une demande en retard porte la mention pour les lecteurs d'écran", async ({
    page,
  }) => {
    await ouvrirEnTantQue(page, "admin", "/", { demandes: DEMANDES });
    await expect(page.getByText(", en attente depuis plus de 3 jours").first()).toBeAttached();
  });
});

test.describe("page /demandes", () => {
  test("?type=question n'affiche que le bloc Questions, en pleine largeur", async ({ page }) => {
    await ouvrirEnTantQue(page, "manager", "/demandes?type=question", { demandes: DEMANDES });
    await expect(page.getByRole("heading", { name: "Questions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Problèmes" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Voir tous les types" })).toBeVisible();
  });

  test("le bloc « Sans type » n'apparaît que sur la page complète, s'il reste des demandes", async ({
    page,
  }) => {
    const sansType = demande("g", "Lou Martin", "Product", "validée", 30, { category: null });
    await ouvrirEnTantQue(page, "manager", "/demandes", { demandes: [...DEMANDES, sansType] });
    await expect(page.getByRole("heading", { name: "Sans type" })).toBeVisible();
  });

  test("sans demande sans type, le bloc « Sans type » est absent", async ({ page }) => {
    await ouvrirEnTantQue(page, "manager", "/demandes", { demandes: DEMANDES });
    await expect(page.getByRole("heading", { name: "Boîte à idées" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sans type" })).toHaveCount(0);
  });

  test("l'admin reste sur /demandes (pas de redirection) et a le lien vers la gestion", async ({ page }) => {
    await ouvrirEnTantQue(page, "admin", "/demandes", { demandes: DEMANDES });
    await expect(page.getByRole("heading", { name: "Demandes du cabinet", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Gérer les demandes (modifier, supprimer) →" })).toHaveAttribute(
      "href",
      "/manage/submissions",
    );
  });

  test("le collaborateur ne voit pas le lien vers la gestion", async ({ page }) => {
    await ouvrirEnTantQue(page, "collaborateur", "/demandes", { demandes: DEMANDES });
    await expect(page.getByRole("heading", { name: "Boîte à idées" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Gérer les demandes/ })).toHaveCount(0);
  });
});
