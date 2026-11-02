import { createFileRoute } from "@tanstack/react-router";
import { timeAgo } from "@/lib/dashboard";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ConfirmDelete,
  ErrorSummary,
  Field,
  FormActions,
  Modal,
  RowActions,
  TextInput,
} from "@/components/manage/crud-ui";
import { metricSchema, validate, type FieldErrors } from "@/lib/manage-schemas";
import { MetricHistory } from "@/components/manage/metric-history";
import {
  createMetric,
  deleteMetric,
  fetchMetricFlags,
  fetchMetrics,
  deltaText,
  formatMetricValue,
  formatObjectif,
  setMetricOnDashboard,
  updateMetricRow,
  TREND_LABELS,
  type Metric,
  type MetricInput,
} from "@/lib/dashboard";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/manage/metrics")({
  head: () => ({
    meta: [
      { title: "Indicateurs clés · Happy Place" },
      {
        name: "description",
        content: "Créez, modifiez et supprimez les indicateurs de Happy Place.",
      },
      { property: "og:title", content: "Indicateurs clés · Happy Place" },
      {
        property: "og:description",
        content: "Gérez les indicateurs de performance dans Happy Place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageMetrics,
});

/** Nombre maximal d'indicateurs affichés sur l'accueil (contrôlé aussi par la base). */
const MAX_ACCUEIL = 4;

type FormState = {
  cle: string;
  label: string;
  value: string;
  unit: string;
  /** Objectif facultatif, saisi comme la valeur (vide : pas d'objectif). */
  target: string;
  /** Coché : plus bas est mieux (ex. délai moyen). */
  plusBas: boolean;
};

const empty: FormState = { cle: "", label: "", value: "", unit: "", target: "", plusBas: false };

/** Clé déduite du libellé : minuscules, sans accent, séparateurs remplacés par « _ ». */
function cleDepuisLibelle(libelle: string) {
  return libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function ManageMetrics() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState<Metric | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [toDelete, setToDelete] = useState<Metric | null>(null);

  const list = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics, retry: false });
  const flags = useQuery({
    queryKey: ["metrics", "flags"],
    queryFn: fetchMetricFlags,
    retry: false,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["metrics"] });
  const onError = (e: unknown) => toast.error((e as Error).message);
  const nbAccueil = [...(flags.data?.values() ?? [])].filter(Boolean).length;

  const save = useMutation({
    mutationFn: (input: MetricInput) =>
      editing ? updateMetricRow(editing.key, input) : createMetric(input),
    onSuccess: async () => {
      toast.success(editing ? "Indicateur modifié" : "Indicateur créé");
      close();
      await invalidate();
    },
    onError,
  });

  const toggleAccueil = useMutation({
    mutationFn: (v: { key: string; on: boolean }) => setMetricOnDashboard(v.key, v.on),
    onSuccess: (_d, v) => {
      toast.success(v.on ? "Affiché sur l'accueil" : "Retiré de l'accueil");
      invalidate();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (key: string) => deleteMetric(key),
    onSuccess: () => {
      toast.success("Indicateur supprimé");
      setToDelete(null);
      invalidate();
    },
    onError,
  });

  function close() {
    setForm(null);
    setEditing(null);
    setErrors({});
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    // À la création, la clé vient des options avancées ou du libellé ; sur un indicateur existant elle ne change pas.
    const cle = editing ? editing.key : form.cle.trim() || cleDepuisLibelle(form.label);
    const raw = form.value.trim().replace(",", ".");
    const rawObjectif = form.target.trim().replace(",", ".");
    const candidate = {
      key: cle,
      label: form.label,
      value: raw === "" || Number.isNaN(Number(raw)) ? Number.NaN : Number(raw),
      unit: form.unit.trim() === "" ? null : form.unit,
      target:
        rawObjectif === ""
          ? null
          : Number.isNaN(Number(rawObjectif))
            ? Number.NaN
            : Number(rawObjectif),
      higher_is_better: !form.plusBas,
    };
    const res = validate(metricSchema, candidate);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    if (!editing && list.data?.some((m) => m.key === cle)) {
      setErrors({
        key: "Un indicateur porte déjà cette clé. Change le libellé ou la clé avancée.",
      });
      return;
    }
    setErrors({});
    save.mutate(res.data);
  }

  const cleProposee = form ? cleDepuisLibelle(form.label) : "";

  return (
    <section className="space-y-md">
      <div className="flex items-center justify-between">
        <h2 className="font-headline-sm text-headline-sm text-primary">
          Indicateurs clés ({list.data?.length ?? 0})
        </h2>
        <button
          onClick={() => {
            setEditing(null);
            setErrors({});
            setForm({ ...empty });
          }}
          type="button"
          className={buttonVariants({ variant: "default" })}
        >
          <span aria-hidden="true" className="material-symbols-outlined">
            add
          </span>{" "}
          Nouvel indicateur
        </button>
      </div>
      <p className="text-body-sm text-on-surface-variant">
        {nbAccueil} sur {MAX_ACCUEIL} affichés sur l'accueil.
      </p>

      {list.isLoading && <p className="text-body-sm text-on-surface-variant">Chargement…</p>}
      {list.isError && (
        <p className="text-body-sm text-error">Impossible de charger les indicateurs.</p>
      )}

      <div className="space-y-xs">
        {list.data?.map((m) => {
          const surAccueil = flags.data?.get(m.key) ?? false;
          return (
            <article
              key={m.key}
              className="flex items-start justify-between gap-sm p-sm bg-card border border-outline-variant"
            >
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <p className="font-body-md text-primary font-bold">
                  {m.label} : {formatMetricValue(m.value, m.unit)}
                </p>
                {m.target != null && (
                  <p className="text-sm font-label-sm text-on-surface-variant mt-xs">
                    {`Objectif ${formatObjectif(m.target, m.unit)} en fin de semestre`}
                    {m.higher_is_better === false ? ", plus bas est mieux" : ""}
                  </p>
                )}
                <p className="text-[11px] font-label-sm text-on-surface-variant mt-xs">
                  {TREND_LABELS[m.trend]}
                  {m.updated_at && <> • Mis à jour {timeAgo(m.updated_at)}</>}
                  {m.previous_value != null && (
                    <>
                      {deltaText(m) && ` · ${deltaText(m)}`}
                      {` · avant : ${formatMetricValue(m.previous_value, m.unit)}`}
                    </>
                  )}
                </p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={surAccueil}
                  disabled={toggleAccueil.isPending}
                  onClick={() => toggleAccueil.mutate({ key: m.key, on: !surAccueil })}
                  className="mt-xs inline-flex min-h-11 items-center gap-sm font-label-sm text-label-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className={`relative inline-block h-5 w-9 rounded-full border border-primary ${surAccueil ? "bg-primary" : "bg-white"}`}
                  >
                    <span
                      className={`absolute top-0.5 size-3.5 rounded-full ${surAccueil ? "left-[18px] bg-white" : "left-0.5 bg-primary"}`}
                    />
                  </span>
                  Afficher sur l'accueil
                </button>
                <MetricHistory metricKey={m.key} unit={m.unit} />
              </div>
              <RowActions
                onEdit={() => {
                  setEditing(m);
                  setErrors({});
                  setForm({
                    cle: "",
                    label: m.label,
                    value: String(m.value),
                    unit: m.unit ?? "",
                    target: m.target != null ? String(m.target) : "",
                    plusBas: m.higher_is_better === false,
                  });
                }}
                onDelete={() => setToDelete(m)}
              />
            </article>
          );
        })}
        {list.data?.length === 0 && (
          <p className="text-body-sm italic text-on-surface-variant">Aucun indicateur.</p>
        )}
      </div>

      {form && (
        <Modal title={editing ? "Modifier l'indicateur" : "Nouvel indicateur"} onClose={close}>
          <form onSubmit={submit} className="space-y-sm" noValidate>
            <ErrorSummary errors={errors} />
            <Field label="Libellé" error={errors.label ?? errors.key} required>
              <TextInput
                value={form.label}
                maxLength={60}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </Field>
            {!editing && (
              <details
                className="border border-outline-variant p-sm"
                open={!!errors.key || undefined}
              >
                <summary className="cursor-pointer min-h-11 font-label-sm text-label-sm text-primary">
                  Options avancées
                </summary>
                <div className="pt-sm">
                  <Field
                    label={`Clé technique (vide : déduite du libellé${cleProposee ? `, ici « ${cleProposee} »` : ""})`}
                    error={errors.key}
                  >
                    <TextInput
                      value={form.cle}
                      maxLength={40}
                      placeholder={cleProposee}
                      onChange={(e) => setForm({ ...form, cle: e.target.value })}
                    />
                  </Field>
                </div>
              </details>
            )}
            <Field label="Valeur" error={errors.value} required>
              <TextInput
                value={form.value}
                inputMode="decimal"
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </Field>
            <Field label="Unité (optionnel)" error={errors.unit}>
              <TextInput
                value={form.unit}
                maxLength={8}
                placeholder="%"
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </Field>
            <Field label="Objectif (facultatif)" error={errors.target}>
              <TextInput
                value={form.target}
                inputMode="decimal"
                placeholder="Ex. 55"
                onChange={(e) => setForm({ ...form, target: e.target.value })}
              />
            </Field>
            <label className="flex min-h-11 items-center gap-sm font-label-sm text-sm text-on-surface">
              <input
                type="checkbox"
                checked={form.plusBas}
                onChange={(e) => setForm({ ...form, plusBas: e.target.checked })}
                className="size-5 accent-[#28282D]"
              />
              Plus bas est mieux
            </label>
            <FormActions pending={save.isPending} onCancel={close} />
          </form>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDelete
          label={toDelete.label}
          pending={remove.isPending}
          onCancel={() => setToDelete(null)}
          onConfirm={() => remove.mutate(toDelete.key)}
        />
      )}
    </section>
  );
}
