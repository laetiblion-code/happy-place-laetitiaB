import { expect, test } from "@playwright/test";
import { ouvrirEnTantQue } from "./support/session-simulee";

const il = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString();

test.describe("info-bulles des compteurs", () => {
  test("le délai de validation explique son calcul au focus et se ferme avec Échap", async ({
    page,
  }) => {
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
    await expect(page.getByText("Délai de validation :")).toBeVisible();

    const aide = page.getByRole("button", { name: "Comment est calculé ce chiffre ?" }).first();
    await aide.focus();
    const bulle = page.getByRole("tooltip");
    await expect(bulle).toContainText("délai de traitement des demandes en attente du cabinet");
    await expect(aide).toHaveAccessibleDescription(/délai de traitement/);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });
});
