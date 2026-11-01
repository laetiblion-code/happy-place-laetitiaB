import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchAdminGaps, plural } from "@/lib/home-counts";

/** Bandeau admin : équipes sans manager et collaborateurs sans équipe. Masqué s'il n'y a rien à signaler. */
export function AdminGapsBanner({ enabled }: { enabled: boolean }) {
  const q = useQuery({
    queryKey: ["home-admin-gaps"],
    queryFn: fetchAdminGaps,
    enabled,
    retry: false,
  });
  if (!enabled || !q.data) return null;
  const { teamsWithoutManager, usersWithoutTeam } = q.data;
  const parts: string[] = [];
  if (teamsWithoutManager.length > 0) {
    parts.push(
      `${plural(teamsWithoutManager.length, "équipe sans manager", "équipes sans manager")} (${teamsWithoutManager.join(", ")})`,
    );
  }
  if (usersWithoutTeam > 0) {
    parts.push(plural(usersWithoutTeam, "utilisateur sans équipe", "utilisateurs sans équipe"));
  }
  if (parts.length === 0) return null;

  return (
    <section
      aria-label="Écarts d'organisation"
      className="flex flex-wrap items-center justify-between gap-sm rounded-md bg-[#F0D0BC] p-sm text-[#28282D]"
    >
      <p className="flex min-w-0 items-start gap-xs font-body-sm text-body-sm">
        <span aria-hidden="true" className="material-symbols-outlined text-base">
          warning
        </span>
        <span className="min-w-0">
          {parts.join(" et ")}. Leurs demandes privées arrivent chez toi.
        </span>
      </p>
      <Link
        to="/manage/users"
        className="font-label-md text-label-md font-semibold text-[#28282D] underline underline-offset-2 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Gérer les utilisateurs et équipes
      </Link>
    </section>
  );
}
