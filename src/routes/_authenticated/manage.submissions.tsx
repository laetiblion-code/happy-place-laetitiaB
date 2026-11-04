import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RejectionNote, StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";
import {
  ConfirmDelete,
  ErrorSummary,
  Field,
  FormActions,
  Modal,
  RowActions,
  Select,
  TextArea,
  TextInput,
} from "@/components/manage/crud-ui";
import { AttachmentLink } from "@/components/attachment-link";
import { CharCounter, rejectionErrorMessage } from "@/components/expandable-card";
import { Linkify } from "@/components/linkify";
import { SubmissionReader } from "@/components/submission-reader";
import { SubmissionHistory } from "@/components/manage/submission-history";
import {
  SUBMISSION_CATEGORY_OPTIONS,
  SUBMISSION_VISIBILITY_OPTIONS,
  VisibilityChip,
} from "@/components/submission-choices";
import {
  correspondFiltre,
  FILTRES,
  FiltresDemandes,
  type Filtre,
} from "@/components/filtres-demandes";
import { attenteDeEquipe } from "@/lib/historique-demande";
import { fetchAdminDirectory } from "@/lib/home-counts";
import { submissionSchema, validate, type FieldErrors } from "@/lib/manage-schemas";
import {
  REJECTION_CATEGORIES,
  createSubmission,
  deleteSubmission,
  fetchAllSubmissions,
  timeAgo,
  updateSubmission,
  type Submission,
  type SubmissionInput,
} from "@/lib/dashboard";

export const Route = createFileRoute("/_authenticated/manage/submissions")({
  head: () => ({
    meta: [
      { title: "Demandes · Happy Place" },
      { name: "description", content: "Créez, modifiez et supprimez les demandes dans Happy Place." },
      { property: "og:title", content: "Demandes · Happy Place" },
      { property: "og:description", content: "Gérez les demandes des pôles du cabinet dans Happy Place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageSubmissions,
});


function ManageSubmissions() {
  const { email } = Route.useRouteContext();
  const moi = (email ?? "").toLowerCase();
  const qc = useQueryClient();
  // Filtres de la liste, comme sur l'accueil (« Demandes du cabinet »)
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [equipe, setEquipe] = useState("");
  // Annuaire : nomme les managers de chaque équipe dans l'historique (« en attente chez … »)
  const annuaire = useQuery({
    queryKey: ["admin-directory"],
    queryFn: fetchAdminDirectory,
    retry: false,
  });
  const [form, setForm] = useState<SubmissionInput | null>(null);
  const [editing, setEditing] = useState<Submission | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [toDelete, setToDelete] = useState<Submission | null>(null);

  const list = useQuery({
    queryKey: ["submissions", "all"],
    queryFn: fetchAllSubmissions,
    retry: false,
  });
  const [reading, setReading] = useState<Submission | null>(null);
  const toutes = list.data ?? [];
  const equipes = [...new Set(toutes.map((s) => s.team))].sort((a, b) => a.localeCompare(b, "fr"));
  const visibles = toutes.filter(
    (s) => correspondFiltre(s, filtre, moi) && (!equipe || s.team === equipe),
  );
  const invalidate = () => qc.invalidateQueries({ queryKey: ["submissions"] });
  const onError = (e: unknown) => toast.error((e as Error).message);

  const save = useMutation({
    mutationFn: (input: SubmissionInput) =>
      editing ? updateSubmission(editing.id, input) : createSubmission(input),
    onSuccess: () => {
      toast.success(editing ? "Demande modifiée" : "Demande créée");
      close();
      invalidate();
    },
    onError: (e: unknown) => toast.error(rejectionErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSubmission(id),
    onSuccess: () => {
      toast.success("Demande supprimée");
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
    const res = validate(submissionSchema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    save.mutate(res.data);
  }

  return (
    <section className="space-y-md">
      <div className="flex items-center justify-between">
        <h1 className="font-headline-sm text-headline-sm text-primary">
          Demandes ({list.data?.length ?? 0})
        </h1>

      </div>

      {list.isLoading && <p className="text-body-sm text-on-surface-variant">Chargement…</p>}
      {list.isError && (
        <p className="text-body-sm text-error">Impossible de charger les demandes.</p>
      )}

      {list.isSuccess && (
        <FiltresDemandes
          filtres={FILTRES}
          filtre={filtre}
          onFiltre={setFiltre}
          equipe={equipe}
          equipes={equipes}
          onEquipe={setEquipe}
          idEquipe="filtre-equipe-gestion"
        />
      )}

      <div className="space-y-xs">
        {visibles.map((s) => (
          <article
            key={s.id}
            className="flex min-w-0 overflow-hidden items-start justify-between gap-sm p-sm bg-card border border-outline-variant"
          >
            <div className="min-w-0 flex-1">
              <p className="font-body-md text-primary font-bold wrap-anywhere">
                {s.author_name} · {s.team}
              </p>
              <p className="text-body-sm text-on-surface-variant italic line-clamp-3 whitespace-pre-line wrap-anywhere">“<Linkify text={s.content} />”</p>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setReading(s)}
                className="font-label-sm text-label-sm text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Ouvrir
              </button>
              <AttachmentLink path={s.attachment_path} name={s.attachment_name} />
              <div className="mt-xs flex flex-wrap items-center gap-xs text-body-sm text-[#68686D]">
                <StatusBadge status={s.status} rejectionCategory={s.rejection_category} />
                <VisibilityChip visibility={s.visibility} />
                <span>{timeAgo(s.created_at)}</span>
              </div>
              {s.status === "refusée" && s.rejection_category && (
                <div className="mt-xs">
                  <RejectionNote category={s.rejection_category} note={s.rejection_note} />
                </div>
              )}
              <SubmissionHistory
                submissionId={s.id}
                attenteChez={attenteDeEquipe(s.team, annuaire.data)}
              />
            </div>
            <RowActions
              onEdit={() => {
                setEditing(s);
                setErrors({});
                setForm({
                  author_name: s.author_name,
                  team: s.team,
                  content: s.content,
                  status: s.status,
                  category: s.category ?? null,
                  visibility: s.visibility ?? "privée",
                  rejection_category: s.rejection_category ?? "",
                  rejection_note: s.rejection_note ?? "",
                });
              }}
              onDelete={() => setToDelete(s)}
            />
          </article>
        ))}
        {list.data?.length === 0 && (
          <p className="text-body-sm italic text-on-surface-variant">Aucune demande.</p>
        )}
        {list.data && list.data.length > 0 && visibles.length === 0 && (
          <p className="text-body-sm italic text-on-surface-variant">
            Aucune demande avec ces filtres.
          </p>
        )}
      </div>

      <SubmissionReader
        moi={(email ?? "").toLowerCase()}
        submission={reading}
        onClose={() => setReading(null)}
      />
      {form && (
        <Modal title="Modifier la demande" onClose={close}
          onSubmit={submit}
          pied={<FormActions pending={save.isPending} onCancel={close} />}
        >
          <div className="space-y-sm">
            <ErrorSummary errors={errors} />
            <Field label="Auteur" error={errors.author_name}>
              <TextInput
                value={form.author_name}
                maxLength={80}
                onChange={(e) => setForm({ ...form, author_name: e.target.value })}
              />
            </Field>
            <Field label="Pôle" error={errors.team}>
              <TextInput
                value={form.team}
                maxLength={60}
                placeholder="Ex. Product team, Cloud & DevOps…"
                onChange={(e) => setForm({ ...form, team: e.target.value })}
              />
            </Field>
            <Field label="Contenu" error={errors.content}>
              <TextArea
                rows={4}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
              <CharCounter value={form.content} max={2000} min={5} />
            </Field>
            <Field label="Type de demande" error={errors.category}>
              <Select
                value={form.category ?? ""}
                onChange={(e) => setForm({ ...form, category: e.target.value || null })}
              >
                <option value="">Non renseigné (demande antérieure)</option>
                {SUBMISSION_CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Visibilité" error={errors.visibility}>
              <Select
                value={form.visibility ?? "privée"}
                onChange={(e) => setForm({ ...form, visibility: e.target.value })}
              >
                {SUBMISSION_VISIBILITY_OPTIONS.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Statut" error={errors.status}>
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="en attente">En attente</option>
                <option value="validée">Validée</option>
                <option value="refusée">Refusée</option>
              </Select>
            </Field>
            {form.status === "refusée" && (
              <>
                <Field label="Motif du refus" error={errors.rejection_category}>
                  <Select
                    value={form.rejection_category ?? ""}
                    onChange={(e) => setForm({ ...form, rejection_category: e.target.value })}
                  >
                    <option value="">Choisir un motif</option>
                    {REJECTION_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Raison du refus (obligatoire)" error={errors.rejection_note}>
                  <TextArea
                    rows={4}
                    value={form.rejection_note ?? ""}
                    onChange={(e) => setForm({ ...form, rejection_note: e.target.value })}
                  />
                  <CharCounter value={form.rejection_note ?? ""} max={500} />
                </Field>
              </>
            )}
          </div>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDelete
          label={toDelete.author_name}
          pending={remove.isPending}
          onCancel={() => setToDelete(null)}
          onConfirm={() => remove.mutate(toDelete.id)}
        />
      )}
    </section>
  );
}
