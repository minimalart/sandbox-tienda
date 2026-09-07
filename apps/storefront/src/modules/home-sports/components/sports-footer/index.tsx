import { getActiveTenant } from "@lib/site-config/active-tenant";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import "../../sports-theme.css";
import SportsFooterNewsletter from "./newsletter";

/**
 * Footer del template Marca Deportiva.
 *
 * Oscuro, alto contraste y mayúsculas. Columnas de navegación, ayuda y contacto
 * + legales. El contenido sale de `assets.sports.footer` y del menú del header.
 * Sustituye al footer de grocery solo cuando el template es "sports".
 */
export default async function SportsFooter() {
  const tenant = await getActiveTenant();
  const sports = tenant.assets.sports;
  const footer = sports?.footer;
  const nav = sports?.header?.nav ?? [];

  // El footer usa el color PRIMARIO real de la marca como fondo. El wrapper
  // `.sports-home` mapea --primary-color a ink (monocromo), así que tomamos el
  // valor configurado del tenant directo y lo aplicamos inline para saltear ese
  // override. Fallback a ink (--sp-ink) si el tenant no define primario.
  // Si la demo configuró un fondo de footer propio, ése gana sobre el primario.
  const background = tenant.theme?.colors?.footerBackground || tenant.theme?.colors?.primary;

  return (
    <footer
      className="sports-home bg-[--sp-ink] text-[--sp-on-dark]"
      style={background ? { backgroundColor: background } : undefined}
    >
      <div className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6 lg:px-10">
        {/* Alta al newsletter (antes era la sección "Sumate al equipo"). */}
        <div className="mb-10 border-white/15 border-b pb-10">
          <SportsFooterNewsletter
            title={sports?.newsletter?.title}
            description={sports?.newsletter?.description}
            placeholder={sports?.newsletter?.placeholder}
            buttonText={sports?.newsletter?.buttonText}
          />
        </div>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <p className="sp-display text-2xl text-white">{tenant.name}</p>
            {footer?.description && (
              <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-white/70">
                {footer.description}
              </p>
            )}
          </div>

          {nav.length > 0 && (
            <div>
              <p className="sp-eyebrow text-white/90">Explorar</p>
              <ul className="mt-3 space-y-2.5">
                {nav.map((item) => (
                  <li key={item.id}>
                    <LocalizedClientLink
                      href={item.href}
                      className="text-[13px] uppercase tracking-wide text-white/65 transition hover:text-white"
                    >
                      {item.name}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="sp-eyebrow text-white/90">Ayuda</p>
            <ul className="mt-3 space-y-2.5">
              <li>
                <LocalizedClientLink
                  href="/account"
                  className="text-[13px] uppercase tracking-wide text-white/65 transition hover:text-white"
                >
                  Mi cuenta
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/cart"
                  className="text-[13px] uppercase tracking-wide text-white/65 transition hover:text-white"
                >
                  Mi carrito
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/store"
                  className="text-[13px] uppercase tracking-wide text-white/65 transition hover:text-white"
                >
                  Catálogo
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/sucursales"
                  className="text-[13px] uppercase tracking-wide text-white/65 transition hover:text-white"
                >
                  Sucursales
                </LocalizedClientLink>
              </li>
            </ul>
          </div>

          <div>
            <p className="sp-eyebrow text-white/90">Contacto</p>
            <ul className="mt-3 space-y-2.5">
              {footer?.contact?.email && (
                <li>
                  <a
                    href={
                      footer.contact.email.href ??
                      `mailto:${footer.contact.email.value}`
                    }
                    className="text-[13px] text-white/65 transition hover:text-white"
                  >
                    {footer.contact.email.value}
                  </a>
                </li>
              )}
              {footer?.contact?.phone && (
                <li className="text-[13px] text-white/65">
                  {footer.contact.phone.value}
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <p className="text-[12px] uppercase tracking-wide text-white/50">
              © {tenant.name}. Todos los derechos reservados.
            </p>
            <a
              href="https://minimalart.co/?utm_source=website&utm_medium=ecommerce&utm_campaign=storefront"
              rel="noreferrer"
              target="_blank"
              className="flex items-center gap-2 opacity-70 transition hover:opacity-100"
            >
              {/* biome-ignore lint/a11y/useAltText: alt provisto */}
              <img
                src="/minimalart/logo-minimalart.svg"
                alt="Minimalart"
                className="h-3 w-auto [filter:brightness(0)_invert(1)]"
              />
              <span className="text-[12px] text-white/60">
                | Evolution by design
              </span>
            </a>
          </div>
          {footer?.legal && footer.legal.length > 0 && (
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {footer.legal.map((item) => (
                <li key={item.href}>
                  <LocalizedClientLink
                    href={item.href}
                    className="text-[12px] uppercase tracking-wide text-white/50 transition hover:text-white"
                  >
                    {item.name}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
