import { getActiveTenant } from "@lib/site-config/active-tenant";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import "../../tech-theme.css";

/**
 * Footer del template Tecnología.
 *
 * Limpio y de baja densidad (Apple): descripción, columnas de categorías y
 * accesos, contacto y legales. Sustituye al footer de grocery solo en el
 * template "technology". El contenido sale de `assets.technology.footer` y del
 * menú de categorías del header.
 */
export default async function TechFooter() {
  const tenant = await getActiveTenant();
  const tech = tenant.assets.technology;
  const footer = tech?.footer;
  const categories = tech?.header?.categories ?? [];

  return (
    <footer className="tech-home border-t border-[--tech-hairline] bg-[color:var(--footer-bg,var(--tech-parchment))] text-[--tech-ink]">
      <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <p className="text-lg font-semibold tracking-tight">{tenant.name}</p>
            {footer?.description && (
              <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-[--tech-muted]">
                {footer.description}
              </p>
            )}
          </div>

          {categories.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold text-[--tech-ink]">
                Categorías
              </p>
              <ul className="mt-3 space-y-2.5">
                {categories.slice(0, 7).map((cat) => (
                  <li key={cat.id}>
                    <LocalizedClientLink
                      href={cat.href}
                      className="text-[13px] text-[--tech-muted] transition hover:text-[--tech-ink]"
                    >
                      {cat.name}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-[13px] font-semibold text-[--tech-ink]">Ayuda</p>
            <ul className="mt-3 space-y-2.5">
              <li>
                <LocalizedClientLink
                  href="/account"
                  className="text-[13px] text-[--tech-muted] transition hover:text-[--tech-ink]"
                >
                  Mi cuenta
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/cart"
                  className="text-[13px] text-[--tech-muted] transition hover:text-[--tech-ink]"
                >
                  Mi carrito
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/store"
                  className="text-[13px] text-[--tech-muted] transition hover:text-[--tech-ink]"
                >
                  Catálogo
                </LocalizedClientLink>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[13px] font-semibold text-[--tech-ink]">
              Contacto
            </p>
            <ul className="mt-3 space-y-2.5">
              {footer?.contact?.email && (
                <li>
                  <a
                    href={footer.contact.email.href ?? `mailto:${footer.contact.email.value}`}
                    className="text-[13px] text-[--tech-muted] transition hover:text-[--tech-ink]"
                  >
                    {footer.contact.email.value}
                  </a>
                </li>
              )}
              {footer?.contact?.phone && (
                <li className="text-[13px] text-[--tech-muted]">
                  {footer.contact.phone.value}
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[--tech-hairline] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-[--tech-subtle]">
            © {tenant.name}. Todos los derechos reservados.
          </p>
          {footer?.legal && footer.legal.length > 0 && (
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {footer.legal.map((item) => (
                <li key={item.href}>
                  <LocalizedClientLink
                    href={item.href}
                    className="text-[12px] text-[--tech-subtle] transition hover:text-[--tech-ink]"
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
