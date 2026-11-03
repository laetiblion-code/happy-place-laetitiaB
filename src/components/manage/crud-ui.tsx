import { createPortal } from "react-dom";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import type { FieldErrors } from "@/lib/manage-schemas";
import { buttonVariants } from "@/components/ui/button";

export function ManageIcon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

const inputBase =
  "w-full rounded-md bg-card border border-[#8A8A90] focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary p-sm font-body-md text-on-surface";

/** Champ de formulaire : libellé relié au contrôle, erreur annoncée (aria-invalid, aria-describedby). */
export function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const erreurId = `${id}-erreur`;
  const premier = Children.toArray(children).find(isValidElement) as ReactElement<{ id?: string; required?: boolean; "aria-describedby"?: string }> | undefined;
  const estControle =
    !!premier && (["input", "select", "textarea"].includes(premier.type as string) || premier.type === TextInput || premier.type === TextArea || premier.type === Select);
  const cibleId = estControle ? (premier!.props.id ?? id) : undefined;
  const rendu = estControle
    ? Children.map(children, (enfant) =>
        enfant === premier
          ? cloneElement(enfant as ReactElement<Record<string, unknown>>, {
              id: cibleId,
              required: required || premier!.props.required,
              "aria-invalid": error ? true : undefined,
              "aria-describedby": error ? erreurId : premier!.props["aria-describedby"],
            })
          : enfant,
      )
    : children;
  return (
    <div className="space-y-xs">
      <label
        htmlFor={cibleId}
        className="font-label-sm text-label-sm text-on-surface-variant uppercase block"
      >
        {label}
        {required ? " (obligatoire)" : null}
      </label>
      {rendu}
      {error ? (
        <p id={erreurId} role="alert" className="text-body-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

type ModaleContexte = { demanderFermeture: () => void };
const ModaleContext = createContext<ModaleContexte | null>(null);

/**
 * Fenêtre modale commune. Rendue dans un portail (document.body) : voile et fenêtre sont dans le même conteneur,
 * la fenêtre est placée après le voile, donc au-dessus.
 * Structure : en-tête (titre, croix), corps défilant, pied fixe (`pied`, par exemple « Annuler » et l'envoi).
 * Croix, clic sur le voile, Échap et « Annuler » ferment la fenêtre ; si `modifie` est vrai, une confirmation
 * (« Abandonner ta saisie ? ») s'affiche d'abord. Avec `onSubmit`, le corps et le pied forment un formulaire.
 */
export function Modal({
  title,
  onClose,
  children,
  modifie = false,
  pied,
  onSubmit,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Un état non visible dans les champs (image, liste) a changé : fermer demande confirmation. */
  modifie?: boolean;
  /** Actions fixes en bas de la fenêtre, visibles sans défiler. */
  pied?: ReactNode;
  /** Présent : le corps et le pied sont un formulaire qui appelle cette fonction à l'envoi. */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const titreId = useId();
  const boite = useRef<HTMLDivElement>(null);
  const [confirmer, setConfirmer] = useState(false);
  const fermer = useRef(onClose);
  fermer.current = onClose;
  // Valeurs des champs à l'ouverture, et indicateur de saisie par la personne (événements input et change) :
  // une saisie est « modifiée » si la personne a touché un champ et que les valeurs ont changé.
  // Les valeurs posées par un effet après l'ouverture ne comptent pas.
  const valeursInitiales = useRef<string | null>(null);
  const touche = useRef(false);

  function valeursDesChamps(): string {
    return Array.from(boite.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "[data-corps-modale] input, [data-corps-modale] textarea, [data-corps-modale] select",
    ) ?? [])
      .map((el) => (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") ? String(el.checked) : el.value))
      .join("\u0001");
  }
  function saisieModifiee(): boolean {
    return modifie || (touche.current && valeursInitiales.current !== null && valeursInitiales.current !== valeursDesChamps());
  }

  // Focus placé dans la fenêtre au montage, rendu au bouton d'origine au démontage.
  // La fenêtre n'est montée que lorsqu'elle est ouverte (les appelants font `{ouvert && <Modal …/>}`) :
  // aucun écouteur global n'existe quand elle est fermée. Le piège du Tab et Échap sont liés à la fenêtre (onKeyDown).
  useEffect(() => {
    const origine = document.activeElement as HTMLElement | null;
    // Focus initial : premier champ du formulaire, sinon premier bouton du corps (pas « Fermer »), sinon la fenêtre elle-même.
    const corps = boite.current?.querySelector<HTMLElement>("[data-corps-modale]") ?? null;
    const dansCorps = (sel: string) => Array.from(corps?.querySelectorAll<HTMLElement>(sel) ?? []);
    const champ = dansCorps('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])')[0];
    const bouton = dansCorps("button:not([disabled]), a[href]")[0];
    (champ ?? bouton ?? boite.current)?.focus();
    valeursInitiales.current = valeursDesChamps();
    const marquer = () => {
      touche.current = true;
    };
    const fenetre = boite.current;
    fenetre?.addEventListener("input", marquer);
    fenetre?.addEventListener("change", marquer);
    return () => {
      fenetre?.removeEventListener("input", marquer);
      fenetre?.removeEventListener("change", marquer);
      origine?.focus?.();
    };
  }, []);

  function demanderFermeture() {
    if (saisieModifiee()) setConfirmer(true);
    else fermer.current();
  }

  function surTouche(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (confirmer) setConfirmer(false);
      else demanderFermeture();
      return;
    }
    if (e.key !== "Tab") return;
    const items = Array.from(
      boite.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (items.length === 0) return;
    const premier = items[0];
    const dernier = items[items.length - 1];
    const actif = document.activeElement;
    if (e.shiftKey && (actif === premier || !boite.current?.contains(actif))) {
      e.preventDefault();
      dernier.focus();
    } else if (!e.shiftKey && (actif === dernier || !boite.current?.contains(actif))) {
      e.preventDefault();
      premier.focus();
    }
  }

  const corps = (
    <>
      <div data-corps-modale className="min-h-0 flex-1 space-y-md overflow-y-auto px-md py-md">
        {children}
      </div>
      {pied !== undefined && (
        <div className="shrink-0 border-t border-outline-variant bg-surface-container-lowest px-md py-sm">{pied}</div>
      )}
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-sm md:p-lg">
      <div aria-hidden="true" onClick={demanderFermeture} className="fixed inset-0 bg-black/50" />
      <div
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        tabIndex={-1}
        onKeyDown={surTouche}
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col rounded-lg border border-outline bg-surface-container-lowest focus:outline-none"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-outline-variant px-md py-sm">
          <h2 id={titreId} className="font-headline-sm text-headline-sm text-primary">{title}</h2>
          <button
            type="button"
            aria-label="Fermer"
            onClick={demanderFermeture}
            className="text-on-surface-variant hover:text-primary"
          >
            <ManageIcon name="close" />
          </button>
        </div>
        <ModaleContext.Provider value={{ demanderFermeture }}>
          {onSubmit ? (
            <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
              {corps}
            </form>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">{corps}</div>
          )}
        </ModaleContext.Provider>
        {confirmer && (
          <div
            role="group"
            aria-label="Confirmer la fermeture"
            className="flex shrink-0 flex-wrap items-center justify-between gap-sm border-t border-outline-variant bg-card px-md py-sm"
          >
            <p className="min-w-0 text-body-sm font-semibold text-on-surface">
              Abandonner ta saisie ? Les champs remplis seront perdus.
            </p>
            <div className="flex flex-wrap gap-xs">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  // La barre disparaît : le focus revient dans la fenêtre (Échap et Tab restent actifs)
                  setConfirmer(false);
                  boite.current?.focus();
                }}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Continuer la saisie
              </button>
              <button
                type="button"
                onClick={() => fermer.current()}
                className={buttonVariants({ variant: "destructive", size: "sm" })}
              >
                Abandonner
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** « Annuler » d'une fenêtre : même fermeture que la croix (confirmation si la saisie est modifiée). */
export function BoutonAnnuler({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  const modale = useContext(ModaleContext);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick ?? modale?.demanderFermeture}
      className={buttonVariants({ variant: "secondary" })}
    >
      Annuler
    </button>
  );
}

export function FormActions({
  pending,
  onCancel,
  submitLabel = "Enregistrer",
}: {
  pending?: boolean;
  onCancel: () => void;
  submitLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-xs">
      <BoutonAnnuler onClick={onCancel} />
      <button type="submit" disabled={pending} className={buttonVariants({ variant: "default" })}>
        {pending ? "…" : submitLabel}
      </button>
    </div>
  );
}

export function ErrorSummary({ errors }: { errors: FieldErrors }) {
  const count = Object.keys(errors).length;
  if (!count) return null;
  return (
    <div role="alert" className="rounded-md text-body-sm text-error border border-error/40 bg-error-container/30 p-sm wrap-anywhere">
      <p>{count} champ{count > 1 ? "s" : ""} à corriger avant l'enregistrement.</p>
      <ul className="mt-xs list-disc pl-md">
        {Object.entries(errors).map(([k, m]) => (
          <li key={k}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

export function RowActions({
  onEdit,
  onDelete,
  deleting,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-xs shrink-0">
      <button type="button" onClick={onEdit} className={buttonVariants({ variant: "secondary", size: "sm" })}>
        <ManageIcon name="edit" /> Modifier
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className={buttonVariants({ variant: "destructive", size: "sm" })}
      >
        <ManageIcon name="delete" /> Supprimer
      </button>
    </div>
  );
}

export function ConfirmDelete({
  label,
  onCancel,
  onConfirm,
  pending,
}: {
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
}) {
  return (
    <Modal
      title="Confirmer la suppression"
      onClose={onCancel}
      pied={
        <div className="flex justify-end gap-xs">
          <BoutonAnnuler onClick={onCancel} />
          <button type="button" onClick={onConfirm} disabled={pending} className={buttonVariants({ variant: "destructive" })}>
            {pending ? "Suppression…" : "Supprimer"}
          </button>
        </div>
      }
    >
      <p className="font-body-md text-on-surface">
        Supprimer définitivement <strong className="text-primary">{label}</strong> ? Cette action est
        irréversible.
      </p>
    </Modal>
  );
}
