import { useEffect, useState } from "react";
import { reloadForChunkError } from "@/lib/chunk-reload";

/** Affiché quand un module de l'application n'existe plus (nouvelle version déployée). Tente un rechargement une fois. */
export function ChunkErrorNotice() {
  const [afficherMessage, setAfficherMessage] = useState(false);

  useEffect(() => {
    if (!reloadForChunkError()) setAfficherMessage(true);
  }, []);

  if (!afficherMessage) return null;

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background px-md">
      <div
        role="alert"
        className="w-[min(100%,28rem)] border border-outline-variant bg-surface-container-lowest p-lg text-center shadow-sm"
      >
        <p className="font-body-md text-body-md text-on-surface">
          Une nouvelle version de Happy Place est en ligne. Recharge la page.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-md h-12 w-full bg-primary font-label-md text-xs uppercase text-on-primary"
        >
          Recharger
        </button>
      </div>
    </div>
  );
}
