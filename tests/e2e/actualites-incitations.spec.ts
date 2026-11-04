import { expect, test } from "@playwright/test";
import { ouvrirEnTantQue } from "./support/session-simulee";

const il = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString();
const dateCourte = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso));

function actualite(i: number, status: string, jours: number) {
  return {
    id: `n${i}`,
    title: `Actualité ${i}`,
    body: "Texte",
    author: "Olivia Bauducel",
    author_email: "test-admin@example.com",
    status,
    created_at: il(jours),
  };
}

test.describe("état des objectifs et pourcentage des actualités", () => {
  test("16 publiées sur 22 : ratio, pourcentage à une décimale et objectif atteint", async ({
    page,
  }) => {
    const actualites = [
      ...Array.from({ length: 16 }, (_, i) => actualite(i, "publiée", 3)),
      ...Array.from({ length: 6 }, (_, i) => actualite(100 + i, "brouillon", 2)),
    ];
    await ouvrirEnTantQue(page, "admin", "/", { actualites });
    // Premier chargement de la suite : Vite compile les modules, d'où un délai plus long
    await expect(page.getByText("16 publiées / 22 ·")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("72,7 %", { exact: true })).toBeVisible();
    await expect(page.getByText(/Objectif de 70\s%\s?: on garde le rythme/)).toBeVisible();
  });

  test("objectif non atteint : texte « on peut le faire » avec son drapeau", async ({ page }) => {
    const actualites = [
      ...Array.from({ length: 10 }, (_, i) => actualite(i, "publiée", 3)),
      ...Array.from({ length: 10 }, (_, i) => actualite(100 + i, "brouillon", 2)),
    ];
    await ouvrirEnTantQue(page, "admin", "/", { actualites });
    await expect(page.getByText(/Objectif de 70\s%\s?: on peut le faire/)).toBeVisible();
    await expect(page.getByText("50,0 %", { exact: true })).toBeVisible();
  });

  test("délai : « on peut le faire » au-delà de 10 % de l'objectif de 2 j", async ({ page }) => {
    await ouvrirEnTantQue(page, "admin", "/", {
      demandes: [
        {
          id: "a",
          author_name: "Olivia Bauducel",
          team: "Product",
          content: "Question",
          status: "validée",
          created_at: il(5),
          submitted_by_email: "a@example.com",
          category: "question",
          visibility: "équipe",
        },
      ],
      historique: [
        { submission_id: "a", changed_at: il(2), old_status: "en attente", new_status: "validée" },
      ],
    });
    await expect(page.getByText(/Objectif .*: on peut le faire/)).toBeVisible();
  });
});

test.describe("incitations à publier", () => {
  test("aucune actualité rédigée : invitation à partager la première et lien vers la fenêtre", async ({
    page,
  }) => {
    await ouvrirEnTantQue(page, "admin", "/", { actualites: [] });
    await expect(page.getByText("Partage ta première actualité avec le cabinet.")).toBeVisible();
    await expect(page.getByText("Objectif de 70\u00a0%")).toHaveCount(0);
    await page.getByRole("button", { name: "Rédiger ma première actu" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("publiées il y a plus de 30 jours : date de la dernière et « Rédiger une actu »", async ({
    page,
  }) => {
    const ancienne = actualite(1, "publiée", 40);
    await ouvrirEnTantQue(page, "admin", "/", { actualites: [ancienne] });
    await expect(
      page.getByText(
        `Ta dernière actualité date du ${dateCourte(ancienne.created_at)}. Une nouvelle à partager ?`,
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Rédiger une actu" })).toBeVisible();
    await expect(page.getByText("Objectif de 70 %")).toHaveCount(0);
  });

  test("aucun brouillon ni publication de la personne : pas de lien « Voir toutes mes actualités »", async ({
    page,
  }) => {
    await ouvrirEnTantQue(page, "admin", "/", { actualites: [] });
    // Sans brouillon, la colonne des brouillons n'existe pas : les publiées occupent toute la largeur
    await expect(page.getByRole("heading", { name: "Publiées récemment" })).toBeVisible();
    await expect(page.getByText("Aucun brouillon en cours.")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Voir toutes mes actualités/ })).toHaveCount(0);
  });
});
