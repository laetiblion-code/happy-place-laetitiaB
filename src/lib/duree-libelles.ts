/**
 * Libellés de durée, sans React. Chaque libellé existe en deux versions : `court` (affiché, unité abrégée)
 * et `long` (lu par les lecteurs d'écran). Un même libellé n'affiche jamais les deux à l'écran.
 */

const JOUR_MS = 86_400_000;

/** Jours entiers entre deux dates ISO (arrondi, jamais négatif). */
export function joursEntre(debut: string, fin: string): number {
  const ecart = new Date(fin).getTime() - new Date(debut).getTime();
  return Math.max(0, Math.round(ecart / JOUR_MS));
}

/** Délai de résolution d'une alerte : « en 12 jours », « en 1 jour », « en moins d'un jour ». */
export function libelleResolution(jours: number): string {
  if (jours < 1) return "en moins d'un jour";
  return `en ${jours} jour${jours > 1 ? "s" : ""}`;
}

/**
 * Compteur « en attente depuis plus de N jours » : court (« 1 en attente depuis plus de 3 j »)
 * et long (« … plus de 3 jours »). `nombre` formate le compteur (virgule décimale, espaces).
 */
export function texteAttenteAncienne(
  n: number,
  nombre: (valeur: number) => string,
  jours: number,
): { court: string; long: string } {
  return {
    court: `${nombre(n)} en attente depuis plus de ${jours}\u00a0j`,
    long: `${nombre(n)} en attente depuis plus de ${jours} jours`,
  };
}

/** Délai depuis une date, version courte pour les cartes : « il y a 42 min », « il y a 5 h », « il y a 2 j ». */
export function ilYAShort(iso: string, maintenant: number = Date.now()): string {
  const min = Math.round((maintenant - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
