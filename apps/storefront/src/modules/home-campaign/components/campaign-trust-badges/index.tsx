import type { CampaignTrustBadge } from "@lib/site-config/types";
import { CampaignIcon } from "../icons";

/**
 * Fila de badges bajo el CTA del hero. Vacío/undefined = no renderiza nada.
 *
 * Colores:
 *  - Icono: `--campaign-accent` (redirigido a `--accent-color` del tenant en
 *    `campaign-theme.css`); antes era verde fijo, ahora hereda de la marca.
 *  - Texto: `text-current` con opacidad — hereda el color del hero contenedor,
 *    que ya elige claro/oscuro según su fondo (pickContrastText).
 */
export default function CampaignTrustBadges({
  items,
}: {
  items?: CampaignTrustBadge[];
}) {
  if (!items?.length) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-current/80">
      {items.map((b) => (
        <li key={b.id} className="flex items-center gap-2">
          <span className="text-[color:var(--campaign-accent)]">
            <CampaignIcon name={b.icon} />
          </span>
          <span>{b.label}</span>
        </li>
      ))}
    </ul>
  );
}
