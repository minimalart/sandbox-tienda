import { getActiveTenant } from "@lib/site-config/active-tenant";
import { pickContrastText } from "@lib/util/contrast";
import "../../campaign-theme.css";

/**
 * Footer del template Campaña. Server-only.
 *
 * Baja densidad de información: nombre + descripción de la institución,
 * dirección física, email de contacto, copyright, y crédito de la plataforma
 * ("Powered by …"). Todo sale de `assets.campaign.footer`; cualquier campo
 * vacío se omite.
 *
 * `footer.backgroundColor` (opcional) pisa el fondo; sin config el preset
 * default deja blanco. El texto elige contraste automático — evita al operador
 * coordinar dos campos.
 */
export default async function CampaignFooter() {
  const tenant = await getActiveTenant();
  const campaign = tenant.assets.campaign;
  const footer = campaign?.footer;

  const bg = footer?.backgroundColor?.trim() || undefined;
  const fg = bg ? (pickContrastText(bg) ?? "#0f1114") : "#ffffff";
  const isDarkText = fg !== "#ffffff";
  const rootStyle: React.CSSProperties = bg
    ? { backgroundColor: bg, color: fg }
    : {};
  // Clases para texto dependiente de contraste. Preservan el treatment previo
  // (opacidades sobre blanco) cuando no hay bg custom.
  const subtleClass = isDarkText ? "text-neutral-600" : "text-white/60";
  const nameClass = isDarkText ? "text-neutral-900" : "text-white";
  const bodyClass = isDarkText ? "text-neutral-700" : "text-white/80";
  const borderClass = isDarkText ? "border-neutral-200" : "border-white/10";
  const linkHoverClass = isDarkText
    ? "transition hover:text-neutral-900 hover:underline underline-offset-2"
    : "transition hover:text-white hover:underline underline-offset-2";

  return (
    <footer
      id="contacto"
      className={
        bg
          ? "campaign-home"
          : "campaign-home bg-[color:var(--campaign-bg,#0f1114)] text-white/80"
      }
      style={rootStyle}
    >
      <div
        className={`mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-2 sm:px-6 sm:py-20 ${bodyClass}`}
      >
        <div>
          <p className={`text-lg font-semibold ${nameClass}`}>{tenant.name}</p>
          {footer?.description ? (
            <p className="mt-3 max-w-md text-sm leading-relaxed">
              {footer.description}
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 text-sm sm:justify-end sm:text-right">
          {footer?.address ? <p>{footer.address}</p> : null}
          {footer?.email ? (
            <a href={`mailto:${footer.email}`} className={linkHoverClass}>
              {footer.email}
            </a>
          ) : null}
        </div>
      </div>

      <div className={`border-t ${borderClass}`}>
        <div
          className={`mx-auto flex max-w-6xl flex-col-reverse items-start justify-between gap-3 px-4 py-6 text-xs sm:flex-row sm:items-center sm:px-6 ${subtleClass}`}
        >
          {footer?.copyright ? <p>{footer.copyright}</p> : <span />}
          {footer?.poweredBy?.label ? (
            footer.poweredBy.href ? (
              <a
                href={footer.poweredBy.href}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  isDarkText
                    ? "transition hover:text-neutral-900"
                    : "transition hover:text-white"
                }
              >
                {footer.poweredBy.label}
              </a>
            ) : (
              <span>{footer.poweredBy.label}</span>
            )
          ) : null}
        </div>
      </div>
    </footer>
  );
}
