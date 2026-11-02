import { defineConfig } from "@playwright/test";

// Tests de bout en bout (clavier, navigation). Supabase est simulé dans les tests : aucun compte réel n'est requis.
// PLAYWRIGHT_CHROMIUM_PATH permet d'utiliser un Chromium déjà installé (sinon, celui de Playwright).
const port = Number(process.env.E2E_PORT ?? 5199);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ["--no-sandbox"] }
      : {},
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}/auth`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
