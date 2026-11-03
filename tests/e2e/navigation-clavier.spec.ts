import { expect, test, type Page } from "@playwright/test";
import { ouvrirEnTantQue } from "./support/session-simulee";

// Nom accessible de l'élément actif (lien, bouton, champ).
async function elementActif(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "";
    return (
      el.getAttribute("aria-label") ||
      el.innerText ||
      el.getAttribute("value") ||
      el.id ||
      el.tagName
    )
      .replace(/\s+/g, " ")
      .trim();
  });
}

// Tabule jusqu'à ce que l'élément actif corresponde au motif, dans une limite raisonnable (sinon piège ou blocage).
async function tabulerJusqua(page: Page, motif: RegExp, limite = 40) {
  for (let i = 0; i < limite; i++) {
    await page.keyboard.press("Tab");
    const nom = await elementActif(page);
    if (motif.test(nom)) return nom;
  }
  throw new Error(
    `Le focus n'a pas atteint « ${motif} » en ${limite} Tab (dernier : « ${await elementActif(page)} »)`,
  );
}

test.describe("navigation au clavier", () => {
  test("l'accueil admin : Déconnexion, Nouvelle demande et le dernier lien sont atteignables sans piège", async ({
    page,
  }) => {
    await ouvrirEnTantQue(page, "admin", "/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");

    // Premier Tab : le lien d'évitement, visible au focus.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeFocused();
    await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeVisible();

    await tabulerJusqua(page, /Déconnexion/);
    await tabulerJusqua(page, /Nouvelle demande/);

    // Dernier lien visible de la page (en ordre du DOM) : doit être atteint sans piège.
    const dernierLien = await page.evaluate(() => {
      const liens = Array.from(document.querySelectorAll<HTMLAnchorElement>("body a[href]")).filter(
        (a) => a.getClientRects().length > 0 && a.tabIndex >= 0,
      );
      const dernier = liens[liens.length - 1];
      return (dernier.getAttribute("aria-label") || dernier.innerText).replace(/\s+/g, " ").trim();
    });
    await tabulerJusqua(page, new RegExp(dernierLien.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), 300);
  });

  test("« Aller au contenu » place le focus sur main#contenu", async ({ page }) => {
    await ouvrirEnTantQue(page, "admin", "/");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    const focusSur = await page.evaluate(() => document.activeElement?.id);
    expect(focusSur).toBe("contenu");
  });
});
