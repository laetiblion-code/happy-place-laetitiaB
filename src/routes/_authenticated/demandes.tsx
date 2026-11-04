import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SessionHeader } from "@/components/session-header";
import { DemandesCabinet, TYPES_DEMANDE, type TypeDemande } from "@/components/cabinet-demandes";
import { SubmissionReader } from "@/components/submission-reader";
import { CharCounter, rejectionErrorMessage } from "@/components/expandable-card";
import { ErrorSummary, Field, FormActions, Modal, TextArea } from "@/components/manage/crud-ui";
import { CLARIFY_CATEGORY } from "@/components/status-badge";
import { rejectionSchema, validate, type FieldErrors } from "@/lib/manage-schemas";
import { REJECTION_CATEGORIES, reviewSubmission, type Submission } from "@/lib/dashboard";
import { buttonVariants } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/demandes")({
  head: () => ({
    meta: [
      { title: "Demandes · Happy Place" },
      { name: "description", content: "Toutes les demandes du cabinet que tu peux lire." },
      { property: "og:title", content: "Demandes · Happy Place" },
      { property: "og:type", content: "website" },
    ],
  }),
  // Adresse « /demandes?type=idee » : n'affiche que ce bloc (type inconnu : tous les blocs)
  validateSearch: (search: Record<string, unknown>): { type?: TypeDemande } =>
    TYPES_DEMANDE.includes(search.type as TypeDemande) ? { type: search.type as TypeDemande } : {},
  component: DemandesPage,
});

function DemandesPage() {
  const { role, email } = Route.useRouteContext();
  const { type } = Route.useSearch();
  const qc = useQueryClient();
  const myEmail = (email ?? "").toLowerCase();
  const isAdmin = role === "admin";
  // Admin, manager ou collaborateur : la page montre les mêmes filtres que l'accueil à chacun
  const roleAffiche = role === "admin" || role === "manager" ? role : "collaborateur";
  const [lue, setLue] = useState<Submission | null>(null);
  // Revue (admin seulement) : refus ou clarification dans une fenêtre, comme sur l'accueil
  const [rejecting, setRejecting] = useState<Submission | null>(null);
  const [modeRefus, setModeRefus] = useState<"refus" | "clarification">("refus");
  const [rejectForm, setRejectForm] = useState({ rejection_category: "", rejection_note: "" });
  const [rejectErrors, setRejectErrors] = useState<FieldErrors>({});

  // Équipes gérées : elles donnent accès aux pièces jointes de ces équipes (même règle que l'accueil)
  const myTeams = useQuery({
    queryKey: ["manager_teams", "mine", email],
    enabled: role === "manager" && !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manager_teams")
        .select("team, allowed_users!inner(email)")
        .eq("allowed_users.email", myEmail);
      if (error) throw error;
      return (data ?? []).map((t) => t.team).sort();
    },
  });

  // Demande que l'admin peut traiter : en attente, et pas la sienne (les règles d'accès filtrent aussi la lecture)
  const traitable = (s: Submission) =>
    isAdmin && s.status === "en attente" && (s.submitted_by_email ?? "").toLowerCase() !== myEmail;

  const review = useMutation({
    mutationFn: reviewSubmission,
    onSuccess: (_d, vars) => {
      if (vars.status === "refusée") {
        setRejecting(null);
        toast.success(vars.rejection_category === CLARIFY_CATEGORY ? "Clarification demandée" : "Demande refusée");
      } else {
        setLue((r) => (r?.id === vars.id ? null : r));
        toast.success("Demande validée");
      }
      qc.invalidateQueries({ queryKey: ["submissions"] });
      qc.invalidateQueries({ queryKey: ["home-counts"] });
    },
    onError: (e: unknown) => toast.error(rejectionErrorMessage(e)),
  });

  function startReject(s: Submission, mode: "refus" | "clarification" = "refus") {
    setLue(null);
    setRejecting(s);
    setModeRefus(mode);
    setRejectErrors({});
    setRejectForm({
      rejection_category: mode === "clarification" ? CLARIFY_CATEGORY : "",
      rejection_note: "",
    });
  }

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen">
      <SessionHeader />
      <main id="contenu" tabIndex={-1} className="focus:outline-none w-full max-w-interface mx-auto p-sm md:p-md space-y-md">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-sm">
          <h1 className="font-headline-lg text-headline-lg text-primary">Demandes du cabinet</h1>
          <Link to="/" className={buttonVariants({ variant: "secondary" })}>
            ← Retour à l'accueil
          </Link>
        </div>
        {isAdmin && (
          <p>
            <Link
              to="/manage/submissions"
              className="text-body-sm font-semibold text-primary underline underline-offset-2 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Gérer les demandes (modifier, supprimer) →
            </Link>
          </p>
        )}
        {(role !== "manager" || myTeams.isSuccess) && (
          <DemandesCabinet
            email={myEmail}
            role={roleAffiche}
            managerTeams={myTeams.data ?? []}
            onRead={setLue}
            variante="page"
            typeChoisi={type}
          />
        )}
      </main>
      <SubmissionReader
        moi={myEmail}
        submission={lue}
        onClose={() => setLue(null)}
        onReject={lue && traitable(lue) ? () => startReject(lue) : undefined}
        onClarify={lue && traitable(lue) ? () => startReject(lue, "clarification") : undefined}
        onApprove={lue && traitable(lue) ? () => review.mutate({ id: lue.id, status: "validée" }) : undefined}
        approving={review.isPending}
      />
      {rejecting && (
        <Modal
          title={modeRefus === "clarification" ? "Demander une clarification" : "Refuser la demande"}
          onClose={() => setRejecting(null)}
          modifie={rejectForm.rejection_note !== ""}
          onSubmit={(e) => {
            e.preventDefault();
            const res = validate(rejectionSchema, rejectForm);
            if (!res.ok) return setRejectErrors(res.errors);
            setRejectErrors({});
            review.mutate({ id: rejecting.id, status: "refusée", ...res.data });
          }}
          pied={<FormActions pending={review.isPending} onCancel={() => setRejecting(null)} />}
        >
          <div className="space-y-sm">
            <p className="max-h-48 overflow-y-auto border border-outline-variant bg-surface-container-low p-xs text-body-sm italic text-on-surface-variant whitespace-pre-line wrap-anywhere">“{rejecting.content}”</p>
            <ErrorSummary errors={rejectErrors} />
            <Field label="Motif du refus" error={rejectErrors.rejection_category}>
              <select
                name="motif-refus"
                className="w-full border border-outline-variant bg-card p-xs text-body-sm"
                value={rejectForm.rejection_category}
                onChange={(e) => setRejectForm({ ...rejectForm, rejection_category: e.target.value })}
              >
                <option value="">Choisir un motif</option>
                {REJECTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field
              label={modeRefus === "clarification" ? "Question pour le collaborateur (obligatoire)" : "Raison du refus (obligatoire)"}
              error={rejectErrors.rejection_note}
            >
              <TextArea
                rows={4}
                value={rejectForm.rejection_note}
                placeholder={modeRefus === "clarification" ? "Pose ta question au collaborateur…" : "Explique au collaborateur pourquoi sa demande est refusée…"}
                onChange={(e) => setRejectForm({ ...rejectForm, rejection_note: e.target.value })}
              />
              <CharCounter value={rejectForm.rejection_note} max={500} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
