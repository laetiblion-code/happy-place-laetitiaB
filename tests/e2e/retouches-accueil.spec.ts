import { expect, test } from "@playwright/test";
import { ouvrirEnTantQue } from "./support/session-simulee";

const il = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString();

function actualite(i: number, status: string) {
  return {
    id: `n${i}`,
    title: `Actualité ${i}`,
    body: "Texte",
    author: "Olivia Bauducel",
    author_email: "test-admin@example.com",
    status,
    created_at: il(i),
  };
}

test.describe("« À suivre » sans départ", () => {
  test("manager sans départ prévu : le bloc n'est pas affiché et « Demandes à traiter » prend toute la largeur", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ouvrirEnTantQue(page, "manager", "/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Demandes à traiter" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "À suivre", exact: true })).toHaveCount(0);

    const largeurs = await page.evaluate(() => {
      const titre = document.getElementById("titre-a-traiter");
      const bloc = titre?.closest("section")?.parentElement;
      const main = document.getElementById("contenu");
      return {
        demandes: titre?.closest("section")?.getBoundingClientRect().width ?? 0,
        ligne: bloc?.getBoundingClientRect().width ?? 0,
        main: main?.getBoundingClientRect().width ?? 0,
      };
    });
    expect(largeurs.demandes).toBeGreaterThan(largeurs.main * 0.9);
  });

  test("admin sans départ et sans équipe sans manager : le bloc n'est pas affiché", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ouvrirEnTantQue(page, "admin", "/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Demandes à traiter" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "À suivre", exact: true })).toHaveCount(0);
  });
});

test.describe("« Actualités du cabinet » et « Nouvelle actu »", () => {
  test("accueil : un seul lien « Voir toutes les actualités », sous les deux colonnes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ouvrirEnTantQue(page, "admin", "/", {
      actualites: [actualite(1, "publiée"), actualite(2, "publiée"), actualite(3, "brouillon")],
    });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Actualités du cabinet" })).toBeVisible();
    const liens = page.getByRole("link", { name: "Voir toutes les actualités" });
    await expect(liens).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Voir toutes mes actualités" })).toHaveCount(0);
  });

  test("page /actualites : bouton « Nouvelle actu » en principal, plus de « Ajouter une actu »", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ouvrirEnTantQue(page, "admin", "/actualites", {
      actualites: [actualite(1, "publiée"), actualite(2, "brouillon")],
    });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Nouvelle actu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ajouter une actu" })).toHaveCount(0);
  });
});

test.describe("« Demandes du cabinet »", () => {
  test("« Boîte à idées » affiche la ligne sur les idées à venir", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ouvrirEnTantQue(page, "admin", "/");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText("Bientôt la possibilité de liker et noter les idées qui te plaisent le plus."),
    ).toBeVisible();
  });
});
