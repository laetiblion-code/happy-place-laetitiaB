import { useRef, useState, type DragEvent } from "react";

/**
 * Glisser-déposer d'un fichier sur une zone. La zone (un conteneur, pas le bouton) reçoit les gestionnaires :
 * un bouton ne reçoit pas toujours les événements de dépôt selon le navigateur. Le clic et le clavier restent
 * assurés par le bouton à l'intérieur de la zone.
 * `glisse` pilote l'état visuel au survol. Le compteur d'entrées et de sorties évite le clignotement quand le
 * pointeur passe sur les enfants de la zone.
 */
export function useDepotFichier(onFichier: (f: File | undefined) => void, desactive = false) {
  const [glisse, setGlisse] = useState(false);
  const compteur = useRef(0);

  const zone = {
    onDragEnter(e: DragEvent<HTMLElement>) {
      e.preventDefault();
      if (desactive) return;
      compteur.current += 1;
      setGlisse(true);
    },
    onDragOver(e: DragEvent<HTMLElement>) {
      // Toujours annulé : sinon le navigateur ouvrirait le fichier déposé à la place de la page
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = desactive ? "none" : "copy";
    },
    onDragLeave(e: DragEvent<HTMLElement>) {
      e.preventDefault();
      compteur.current = Math.max(0, compteur.current - 1);
      if (compteur.current === 0) setGlisse(false);
    },
    onDrop(e: DragEvent<HTMLElement>) {
      e.preventDefault();
      compteur.current = 0;
      setGlisse(false);
      if (desactive) return;
      onFichier(e.dataTransfer?.files?.[0]);
    },
  };

  return { glisse, zone };
}
