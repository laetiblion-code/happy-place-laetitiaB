import { expect, test } from "@playwright/test";
import { ouvrirEnTantQue } from "./support/session-simulee";

const il = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString();
const demande = (id: string, statut: string, jours: number, extra = {}) => ({
  id,
  author_name: `Personne ${id}`,
  team: "Product",
  content: "Une demande de test pour la gestion.",
  status: statut,
  created_at: il(jours),
  submitted_by_email: `${id}@example.com`,
  category: "question",
  visibility: "entreprise",
  attachment_path: null,
  attachment_name: null,
  rejection_category: null,
  rejection_note: null,
  ...extra,
});

test.describe("gestion des demandes (admin)", () => {
  test("filtres de l'accueil et pilule de visibilité sur chaque carte", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ouvrirEnTantQue(page, "admin", "/manage/submissions", {
      demandes: [demande("ancienne", "en attente", 6), demande("recente", "en attente", 0)],
    });
    await page.waitForLoadState("networkidle");

    const filtres = page.getByRole("group", { name: "Filtrer les demandes" });
    for (const libelle of ["Toutes", "Mes demandes", "Avec pièce jointe", "En retard (+3 j)"]) {
      await expect(filtres.getByRole("button", { name: libelle })).toBeVisible();
    }
    await expect(page.getByText("Entreprise", { exact: true }).first()).toBeVisible();

    await filtres.getByRole("button", { name: "En retard (+3 j)" }).click();
    await expect(filtres.getByRole("button", { name: "En retard (+3 j)" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Personne ancienne")).toBeVisible();
    await expect(page.getByText("Personne recente")).toHaveCount(0);
  });
});

test.describe("« Mes demandes » sans demande", () => {
  test("pas d'export, pas de tri, pas de compteurs à zéro ; message et bouton « Nouvelle demande »", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ouvrirEnTantQue(page, "collaborateur", "/", { demandes: [] });
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText("Tu n'as pas encore envoyé de demande. Une question, une idée, un problème ?"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Nouvelle demande" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Exporter mes demandes/ })).toHaveCount(0);
    await expect(page.getByText("Tri : Plus récentes d'abord")).toHaveCount(0);
    await expect(page.getByText("à compléter")).toHaveCount(0);
  });
});

test.describe("auteur d'une actualité sans nom", () => {
  test("un collaborateur ne voit pas d'adresse : « Par un manager »", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ouvrirEnTantQue(page, "collaborateur", "/", {
      actualites: [
        {
          id: "n1",
          title: "Actualité sans nom",
          body: "Texte",
          author: "kesha.test+manager@example.com",
          author_email: "kesha.test+manager@example.com",
          status: "publiée",
          created_at: il(1),
        },
      ],
    });
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Par un manager")).toBeVisible();
    await expect(page.getByText(/example\.com/)).toHaveCount(0);
  });
});

test.describe("une seule page d'actualités (admin)", () => {
  const publiee = {
    id: "n1",
    title: "Actualité publiée",
    body: "Texte",
    author: "Olivia Bauducel",
    author_email: "test-admin@example.com",
    status: "publiée",
    created_at: il(1),
  };

  test("/manage/news redirige vers /actualites, qui affiche le compteur des publiées", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ouvrirEnTantQue(page, "admin", "/manage/news", { actualites: [publiee] });
    await page.waitForURL(/\/actualites$/);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Nouvelle actu" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Publiées (1)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ajouter une actu" })).toHaveCount(0);
  });

  test("l'admin peut repasser une actualité publiée en brouillon ; le manager, non", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ouvrirEnTantQue(page, "admin", "/actualites", { actualites: [publiee] });
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("button", { name: "Repasser en brouillon l'actualité « Actualité publiée »" }),
    ).toBeVisible();
  });

  test("le manager ne voit pas l'action « Repasser en brouillon »", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ouvrirEnTantQue(page, "manager", "/actualites", { actualites: [{ ...publiee, author_email: "test-admin@example.com" }] });
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Repasser en brouillon")).toHaveCount(0);
  });
});
