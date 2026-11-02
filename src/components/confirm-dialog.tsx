import { useCallback, useState, type ReactNode } from "react";
import { Modal } from "@/components/manage/crud-ui";
import { buttonVariants } from "@/components/ui/button";

type Demande = {
  titre: string;
  message: ReactNode;
  libelleConfirmer: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
};

/**
 * Remplace window.confirm par une fenêtre accessible (Modal) avec « Annuler » et le verbe de l'action.
 * Usage : const [demander, dialogue] = useConfirm(); ... if (!(await demander({...}))) return; ... {dialogue}
 */
export function useConfirm() {
  const [demande, setDemande] = useState<Demande | null>(null);

  const demander = useCallback(
    (opts: Omit<Demande, "resolve">) =>
      new Promise<boolean>((resolve) => setDemande({ ...opts, resolve })),
    [],
  );

  function repondre(ok: boolean) {
    demande?.resolve(ok);
    setDemande(null);
  }

  const dialogue = demande ? (
    <Modal title={demande.titre} onClose={() => repondre(false)}>
      <div className="font-body-md text-on-surface">{demande.message}</div>
      <div className="flex justify-end gap-xs pt-sm">
        <button type="button" onClick={() => repondre(false)} className={buttonVariants({ variant: "secondary" })}>
          Annuler
        </button>
        <button
          type="button"
          onClick={() => repondre(true)}
          className={buttonVariants({ variant: demande.destructive ? "destructive" : "default" })}
        >
          {demande.libelleConfirmer}
        </button>
      </div>
    </Modal>
  ) : null;

  return [demander, dialogue] as const;
}
