// Rechargement après déploiement : une page ouverte avant une nouvelle version essaie de charger
// un module JS qui n'existe plus. On recharge une fois, avec un garde-fou dans sessionStorage.

export const CHUNK_RELOAD_KEY = "hp-chunk-reload";
const CHUNK_RELOAD_WINDOW_MS = 10_000;
const CHUNK_ERROR_MARKERS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
];

function messageDe(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

export function isChunkLoadError(error: unknown): boolean {
  const message = messageDe(error);
  return CHUNK_ERROR_MARKERS.some((marker) => message.includes(marker));
}

/** Recharge la page si aucun rechargement n'a eu lieu dans les 10 dernières secondes. Renvoie true si le rechargement est lancé. */
export function reloadForChunkError(): boolean {
  try {
    const dernier = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY));
    if (Number.isFinite(dernier) && dernier > 0 && Date.now() - dernier < CHUNK_RELOAD_WINDOW_MS) {
      return false;
    }
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

let listenerInstalle = false;

/** Écoute l'événement émis par Vite quand le chargement d'un module dynamique échoue. */
export function installChunkReloadListener() {
  if (typeof window === "undefined" || listenerInstalle) return;
  listenerInstalle = true;
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForChunkError()) event.preventDefault();
  });
}
