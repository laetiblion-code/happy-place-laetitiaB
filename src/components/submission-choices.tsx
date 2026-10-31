import { Building2, Check, CircleHelp, Lightbulb, Lock, Sparkles, TriangleAlert, Users, type LucideIcon } from "lucide-react";

type Choice = { value: string; label: string; help: string; icon: LucideIcon; labelClass?: string };

export const SUBMISSION_CATEGORY_OPTIONS: Choice[] = [
  { value: "question", label: "Question", help: "Tu cherches une information ou une réponse.", icon: CircleHelp },
  { value: "idée", label: "Idée", help: "Tu proposes quelque chose pour Bigger Boat.", icon: Lightbulb },
  { value: "problème", label: "Problème", help: "Tu signales un souci que tu rencontres.", icon: TriangleAlert },
  {
    value: "amélioration de Happy Place",
    label: "Amélioration de Happy Place",
    help: "Tu proposes un changement de l'outil Happy Place.",
    icon: Sparkles,
  },
];

export const SUBMISSION_VISIBILITY_OPTIONS: Choice[] = [
  { value: "privée", label: "Privée", help: "Seuls toi et la personne qui la traite la voient.", icon: Lock, labelClass: "font-bold" },
  { value: "équipe", label: "Mon équipe", help: "Ton équipe la voit une fois validée.", icon: Users },
  { value: "entreprise", label: "Entreprise", help: "Toute l'entreprise la voit une fois validée.", icon: Building2 },
];

/** Groupe de boutons radio : fieldset/legend natifs, flèches du clavier, aide du choix sélectionné. */
export function ChoiceGroup({
  legend,
  name,
  options,
  value,
  onChange,
  error,
  layout,
}: {
  legend: string;
  name: string;
  options: Choice[];
  value: string | null | undefined;
  onChange: (value: string) => void;
  error?: string;
  layout: "cards" | "pills";
}) {
  const selected = options.find((o) => o.value === value);
  const errorId = `${name}-error`;
  const helpId = `${name}-help`;

  return (
    <fieldset className="space-y-xs" aria-describedby={error ? errorId : helpId}>
      <legend className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-xs">{legend}</legend>
      <div className={layout === "cards" ? "grid grid-cols-2 md:grid-cols-4 gap-xs" : "flex flex-wrap gap-xs"}>
        {options.map((o, i) => {
          const id = `${name}-${i}`;
          const checked = o.value === value;
          const Icon = o.icon;
          return (
            <div key={o.value} className="contents">
              <input
                id={id}
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                className={[
                  "relative flex min-h-[44px] cursor-pointer select-none items-center gap-xs border-2 transition-colors",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#28282D]",
                  layout === "cards"
                    ? "flex-col justify-center p-sm text-center"
                    : "rounded-full px-md py-xs",
                  checked ? "border-[#28282D]" : "border-transparent",
                  "bg-[#EDEBE6] hover:border-[#28282D]/40",
                ].join(" ")}
              >
                {layout === "cards" ? (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#28282D]">
                    <Icon aria-hidden="true" className="h-5 w-5 text-white" />
                  </span>
                ) : (
                  <Icon aria-hidden="true" className="h-4 w-4 text-[#28282D]" />
                )}
                <span className={`font-label-sm text-label-sm uppercase text-[#28282D] ${o.labelClass ?? ""}`}>
                  {o.label}
                </span>
                {layout === "cards" ? (
                  checked && <Check aria-hidden="true" className="absolute right-xs top-xs h-4 w-4 text-[#28282D]" />
                ) : (
                  // Emplacement toujours réservé : la pilule garde la même largeur selon l'état
                  <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center ${checked ? "" : "invisible"}`}>
                    <Check className="h-4 w-4 text-[#28282D]" />
                  </span>
                )}
              </label>
            </div>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-body-sm text-error">
          {error}
        </p>
      ) : (
        selected && (
          <p id={helpId} className="text-body-sm text-on-surface-variant">
            {selected.help}
          </p>
        )
      )}
    </fieldset>
  );
}

/** Étiquette de catégorie et pilule de visibilité, pour les cartes et la fenêtre de lecture. */
export function SubmissionTags({ category, visibility }: { category?: string | null; visibility?: string | null }) {
  const cat = SUBMISSION_CATEGORY_OPTIONS.find((o) => o.value === category);
  const vis = SUBMISSION_VISIBILITY_OPTIONS.find((o) => o.value === visibility);
  if (!cat && !vis) return null;
  return (
    <div className="flex flex-wrap gap-xs">
      {cat && (
        <span className="inline-flex items-center gap-xs bg-[#EDEBE6] px-xs py-[2px] font-label-sm text-label-sm uppercase text-[#28282D]">
          <cat.icon aria-hidden="true" className="h-3 w-3" />
          {cat.label}
        </span>
      )}
      {vis && (
        <span className={`inline-flex items-center gap-xs rounded-full bg-[#EDEBE6] px-xs py-[2px] font-label-sm text-label-sm text-[#28282D] ${vis.labelClass ?? ""}`}>
          <vis.icon aria-hidden="true" className="h-3 w-3" />
          {vis.label}
        </span>
      )}
    </div>
  );
}
