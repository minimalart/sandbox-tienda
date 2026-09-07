import { getActiveTenant } from "@lib/site-config/active-tenant";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import "../../campaign-theme.css";

/**
 * Footer del template Campaña. Server-only.
 *
 * Baja densidad de información: nombre + descripción de la institución,
 * dirección física, email de contacto, copyright, y crédito de la plataforma
 * ("Powered by …"). Todo sale de `assets.campaign.footer`; cualquier campo
 * vacío se omite.
 */
export default async function CampaignFooter() {
  const tenant = await getActiveTenant();
  const campaign = tenant.assets.campaign;
  const footer = campaign?.footer;

  return (
    <footer
      id="contacto"
      className="campaign-home bg-[color:var(--campaign-bg,#0f1114)] text-white/80"
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-2 sm:px-6 sm:py-20">
        <div>
          <p className="text-lg font-semibold text-white">{tenant.name}</p>
          {footer?.description ? (
            <p className="mt-3 max-w-md text-sm leading-relaxed">
              {footer.description}
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 text-sm sm:justify-end sm:text-right">
          {footer?.address ? <p>{footer.address}</p> : null}
          {footer?.email ? (
            <a
              href={`mailto:${footer.email}`}
              className="underline-offset-2 transition hover:text-white hover:underline"
            >
              {footer.email}
            </a>
          ) : null}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col-reverse items-start justify-between gap-3 px-4 py-6 text-xs text-white/60 sm:flex-row sm:items-center sm:px-6">
          {footer?.copyright ? <p>{footer.copyright}</p> : <span />}
          {footer?.poweredBy?.label ? (
            footer.poweredBy.href ? (
              <a
                href={footer.poweredBy.href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-white"
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
