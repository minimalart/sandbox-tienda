import type { CampaignBadgeIcon } from "@lib/site-config/types";

/**
 * Iconos SVG mínimos para los trust badges del template Campaña. Se mantiene
 * el set chico a propósito: la landing tiene pocos badges y agregarle Lucide
 * al bundle solo para 6 íconos no vale la pena.
 */

type IconProps = { className?: string };

const base = "h-4 w-4 shrink-0";

export function CampaignIcon({
  name,
  className,
}: {
  name: CampaignBadgeIcon;
  className?: string;
}) {
  const cls = className ?? base;
  switch (name) {
    case "credit-card":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
    case "store":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M3 9l2-5h14l2 5v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9z" />
          <path d="M5 11v9h14v-9" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M12 3l8 3v6c0 4.5-3.4 8.6-8 10-4.6-1.4-8-5.5-8-10V6z" />
        </svg>
      );
    case "truck":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "sparkles":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
        </svg>
      );
    case "gift":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <rect x="3" y="8" width="18" height="4" rx="1" />
          <path d="M5 12v9h14v-9M12 8v13M8.5 8a2.5 2.5 0 1 1 0-5c2 0 3.5 3 3.5 5M15.5 8a2.5 2.5 0 1 0 0-5c-2 0-3.5 3-3.5 5" />
        </svg>
      );
    case "graduation-cap":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M12 3L2 8l10 5 10-5-10-5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
        </svg>
      );
    default:
      return null;
  }
}
