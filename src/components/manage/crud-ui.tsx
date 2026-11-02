import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
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

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titreId = useId();
  const boite = useRef<HTMLDivElement>(null);
  const fermer = useRef(onClose);
  fermer.current = onClose;

  // Focus placé dans la fenêtre, piégé pendant qu'elle est ouverte, rendu au bouton d'origine, Échap ferme.
  useEffect(() => {
    const origine = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        boite.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    // Focus initial : premier champ du formulaire, sinon premier bouton du corps (pas « Fermer »), sinon la fenêtre elle-même.
    const corps = boite.current?.querySelector<HTMLElement>("[data-corps-modale]") ?? null;
    const dansCorps = (sel: string) => Array.from(corps?.querySelectorAll<HTMLElement>(sel) ?? []);
    const champ = dansCorps('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])')[0];
    const bouton = dansCorps("button:not([disabled]), a[href]")[0];
    (champ ?? bouton ?? boite.current)?.focus();
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        fermer.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
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
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("keydown", surTouche);
      origine?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-sm md:p-lg">
      <div
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        tabIndex={-1}
        className="w-full max-w-2xl rounded-lg bg-surface-container-lowest border border-outline p-md space-y-md"
      >
        <div className="flex items-center justify-between border-b border-outline-variant pb-sm">
          <h2 id={titreId} className="font-headline-sm text-headline-sm text-primary">{title}</h2>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="text-on-surface-variant hover:text-primary"
          >
            <ManageIcon name="close" />
          </button>
        </div>
        <div data-corps-modale className="space-y-md">{children}</div>
      </div>
    </div>
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
    <div className="flex justify-end gap-xs pt-sm">
      <button type="button" onClick={onCancel} className={buttonVariants({ variant: "secondary" })}>
        Annuler
      </button>
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
    <Modal title="Confirmer la suppression" onClose={onCancel}>
      <p className="font-body-md text-on-surface">
        Supprimer définitivement <strong className="text-primary">{label}</strong> ? Cette action est
        irréversible.
      </p>
      <div className="flex justify-end gap-xs pt-sm">
        <button type="button" onClick={onCancel} className={buttonVariants({ variant: "secondary" })}>
          Annuler
        </button>
        <button type="button" onClick={onConfirm} disabled={pending} className={buttonVariants({ variant: "destructive" })}>
          {pending ? "Suppression…" : "Supprimer"}
        </button>
      </div>
    </Modal>
  );
}
