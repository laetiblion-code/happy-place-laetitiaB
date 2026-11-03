import type { Page } from "@playwright/test";

// Session Supabase simulée : le client lit le jeton dans localStorage, puis interroge /auth/v1/user
// et les tables de la liste blanche. Les réponses sont interceptées, rien ne part vers le vrai projet.
const SUPABASE = "https://mosrbmjsuahdxeiqitad.supabase.co";
const CLE_SESSION = "sb-mosrbmjsuahdxeiqitad-auth-token";
const EMAIL = "test-admin@example.com";

const utilisateur = {
  id: "00000000-0000-0000-0000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: EMAIL,
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

const session = {
  access_token:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwIiwiZXhwIjo0MTAyNDQ0ODAwfQ.test",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: "refresh-test",
  user: utilisateur,
};

export async function ouvrirEnTantQue(
  page: Page,
  role: "admin" | "manager" | "collaborateur",
  chemin = "/",
  options: { demandes?: unknown[] } = {},
) {
  await page.route(`${SUPABASE}/**`, (route) => {
    const url = new URL(route.request().url());
    const reponse = (corps: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
    if (url.pathname.startsWith("/auth/v1/user")) return reponse(utilisateur);
    if (url.pathname.startsWith("/auth/v1/")) return reponse(session);
    if (url.pathname.startsWith("/rest/v1/allowed_users"))
      return reponse([{ id: 1, email: EMAIL, first_name: "Olivia" }]);
    if (url.pathname.startsWith("/rest/v1/allowed_user_roles"))
      return reponse([{ role, allowed_user_id: 1 }]);
    if (url.pathname.startsWith("/rest/v1/submissions")) return reponse(options.demandes ?? []);
    return reponse([]);
  });
  await page.addInitScript(
    ([cle, valeur]) => localStorage.setItem(cle, valeur),
    [CLE_SESSION, JSON.stringify(session)],
  );
  await page.goto(chemin);
}
