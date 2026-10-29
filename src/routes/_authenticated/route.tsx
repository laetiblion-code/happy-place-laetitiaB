import {
  createFileRoute,
  ErrorComponent,
  isRedirect,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchOwnRole, signOut } from "@/lib/auth";
import { BrandHeader } from "@/components/brand-header";
import { Button } from "@/components/ui/button";

// Accès réservé à la liste blanche (allowed_users + allowed_user_roles) gérée par un admin.
// Un compte connecté sans rôle voit un écran « Accès non autorisé » au lieu de l'application.
class UnauthorizedError extends Error {
  constructor(public email: string) {
    super("unauthorized");
  }
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });
      const email = data.user.email ?? "";
      const role = email ? await fetchOwnRole(email) : null;
      if (!role) throw new UnauthorizedError(email);
      return { user: data.user, email, role };
    } catch (e) {
      if (isRedirect(e) || e instanceof UnauthorizedError) throw e;
      // Session périmée ou compte changé dans un autre onglet : retour propre à la connexion.
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      throw redirect({ to: "/auth" });
    }
  },
  errorComponent: ({ error }) =>
    error instanceof UnauthorizedError ? (
      <AccesNonAutorise email={error.email} />
    ) : (
      <ErrorComponent error={error} />
    ),
  component: () => <Outlet />,
});

function AccesNonAutorise({ email }: { email: string }) {
  return (
    <div className="min-h-dvh w-full bg-background flex flex-col">
      <BrandHeader />
      <main className="flex flex-1 items-center justify-center px-md py-lg">
        <section className="w-[min(100%,28rem)] border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
          <h1 className="font-headline-lg text-headline-lg text-primary">Accès non autorisé</h1>
          <p className="mt-sm font-body-md text-body-md text-on-surface-variant" role="alert">
            {email ? (
              <>
                Le compte <strong>{email}</strong> n'a pas accès à Happy Place. Contacte un admin.
              </>
            ) : (
              "Ce compte n'a pas accès à Happy Place. Contacte un admin."
            )}
          </p>
          <Button
            onClick={() => void signOut()}
            className="mt-md h-12 w-full rounded-none font-label-md text-xs uppercase text-on-primary"
          >
            SE DÉCONNECTER
          </Button>
        </section>
      </main>
    </div>
  );
}
