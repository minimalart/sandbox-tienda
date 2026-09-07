import type { CampaignTrustBadge } from "@lib/site-config/types";
import { CampaignIcon } from "../icons";

/**
 * Fila de badges bajo el CTA del hero. Vacío/undefined = no renderiza nada.
 */
export default function CampaignTrustBadges({
  items,
}: {
  items?: CampaignTrustBadge[];
}) {
  if (!items?.length) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/80">
      {items.map((b) => (
        <li key={b.id} className="flex items-center gap-2">
          <span className="text-[color:var(--campaign-accent,#22c55e)]">
            <CampaignIcon name={b.icon} />
          </span>
          <span>{b.label}</span>
        </li>
      ))}
    </ul>
  );
}
