import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EXPORT_INFO_MES_DEMANDES } from "@/hooks/use-export-mes-demandes";

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
 * Identité et actions du compte, à droite de l'en-tête : prénom en gras, rôle dessous, avatar, déconnexion.
 * L'avatar ouvre le menu du compte (mot de passe, et pour un manager ou un admin l'export des demandes,
 * qui n'a pas de bloc « Mes demandes » sur l'accueil).
 */
export function AccountBar({
  firstName,
  email,
  roleLabel,
  showExport,
  exporting,
  onExport,
  onSignOut,
}: {
  firstName: string;
  email: string;
  roleLabel: string;
  /** Vrai pour un manager ou un admin : l'export passe alors dans le menu du compte. */
  showExport: boolean;
  exporting: boolean;
  onExport: () => void;
  onSignOut: () => void;
}) {
  const name = firstName || email;

  return (
    <div className="flex min-w-0 items-center gap-sm">
      <div className="min-w-0 text-right">
        <p className="font-body-md text-body-md font-bold text-primary wrap-anywhere">{name}</p>
        <p className="font-label-sm text-sm text-on-surface-variant">{roleLabel}</p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Menu du compte, ${name}`}
          className={`flex size-11 shrink-0 items-center justify-center rounded-[8px] bg-primary text-on-primary ${FOCUS}`}
        >
          <Icon name="person" />
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
          {showExport && (
            <DropdownMenuItem
              disabled={exporting}
              onSelect={onExport}
              title={EXPORT_INFO_MES_DEMANDES}
              className="min-h-11 cursor-pointer"
            >
              <Icon name="file_download" /> Exporter mes demandes (CSV)
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button type="button" variant="secondary" size="sm" onClick={onSignOut} className="shrink-0">
        <Icon name="logout" /> Déconnexion
      </Button>
    </div>
  );
}
