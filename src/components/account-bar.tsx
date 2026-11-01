import { Link } from "@tanstack/react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * Identité et actions du compte, dans la barre du haut.
 * Bureau : avatar, prénom, rôle et boutons. Mobile : un menu accessible au clavier (Radix).
 */
export function AccountBar({
  firstName,
  email,
  roleLabel,
  isAdmin,
  exporting,
  onExport,
  onSignOut,
}: {
  firstName: string;
  email: string;
  roleLabel: string;
  isAdmin: boolean;
  exporting: boolean;
  onExport: () => void;
  onSignOut: () => void;
}) {
  const name = firstName || email;
  const avatar = (
    <span
      aria-hidden="true"
      className="flex size-11 shrink-0 items-center justify-center rounded-[8px] bg-primary text-on-primary"
    >
      <Icon name="person" />
    </span>
  );

  return (
    <div className="flex min-w-0 items-center gap-md">
      {/* Bureau */}
      <div className="hidden min-w-0 items-center gap-md md:flex">
        <div className="flex min-w-0 items-center gap-sm">
          {avatar}
          <div className="min-w-0 text-right">
            <p className="font-body-md text-body-md font-semibold text-primary wrap-anywhere">
              {name}
            </p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">{roleLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-xs">
          <Link to="/mot-de-passe" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <Icon name="key" /> Mot de passe
          </Link>
          {isAdmin && (
            <Link
              to="/manage/news"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <Icon name="database" /> Gérer les données
            </Link>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={exporting}
            onClick={onExport}
          >
            <Icon name="file_download" /> {exporting ? "Export en cours…" : "Exporter le rapport"}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onSignOut}>
            <Icon name="logout" /> Déconnexion
          </Button>
        </div>
      </div>

      {/* Mobile : menu */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Menu du compte, ${name}`}
            className={`${buttonVariants({ variant: "secondary" })} gap-sm px-sm ${FOCUS}`}
          >
            {avatar}
            <Icon name="menu" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56 p-xs">
            <DropdownMenuLabel className="font-normal">
              <span className="block font-semibold text-primary wrap-anywhere">{name}</span>
              <span className="block text-on-surface-variant">{roleLabel}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="min-h-11 cursor-pointer">
              <Link to="/mot-de-passe">
                <Icon name="key" /> Mot de passe
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild className="min-h-11 cursor-pointer">
                <Link to="/manage/news">
                  <Icon name="database" /> Gérer les données
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={exporting}
              onSelect={onExport}
              className="min-h-11 cursor-pointer"
            >
              <Icon name="file_download" /> {exporting ? "Export en cours…" : "Exporter le rapport"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSignOut} className="min-h-11 cursor-pointer">
              <Icon name="logout" /> Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
