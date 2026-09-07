import { getActiveTenant } from "@lib/site-config/active-tenant";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import "../../tech-retail-theme.css";

/**
 * Footer del template Tecnología Retail.
 *
 * Columnas de categorías, ayuda y contacto + legales. El contenido sale de
 * `assets.techRetail.footer` y del menú de categorías del header. Sustituye al
 * footer de grocery solo cuando el template es "tech-retail".
 */
export default async function TrFooter() {
  const tenant = await getActiveTenant();
  const tr = tenant.assets.techRetail;
  const footer = tr?.footer;
  const categories = tr?.header?.categories ?? [];

  return (
    <footer className="tech-retail-home border-t border-[--tr-hairline] bg-[color:var(--footer-bg,var(--tr-surface))] text-[--tr-ink]">
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <p className="text-lg font-extrabold tracking-tight">{tenant.name}</p>
            {footer?.description && (
              <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-[--tr-muted]">
                {footer.description}
              </p>
            )}
          </div>

          {categories.length > 0 && (
            <div>
              <p className="text-[13px] font-bold text-[--tr-ink]">Categorías</p>
              <ul className="mt-3 space-y-2.5">
                {categories.slice(0, 7).map((cat) => (
                  <li key={cat.id}>
                    <LocalizedClientLink
                      href={cat.href}
                      className="text-[13px] text-[--tr-muted] transition hover:text-[--tr-blue]"
                    >
                      {cat.name}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-[13px] font-bold text-[--tr-ink]">Ayuda</p>
            <ul className="mt-3 space-y-2.5">
              <li>
                <LocalizedClientLink
                  href="/account"
                  className="text-[13px] text-[--tr-muted] transition hover:text-[--tr-blue]"
                >
                  Mi cuenta
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/cart"
                  className="text-[13px] text-[--tr-muted] transition hover:text-[--tr-blue]"
                >
                  Mi carrito
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/store"
                  className="text-[13px] text-[--tr-muted] transition hover:text-[--tr-blue]"
                >
                  Catálogo
                </LocalizedClientLink>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[13px] font-bold text-[--tr-ink]">Contacto</p>
            <ul className="mt-3 space-y-2.5">
              {footer?.contact?.email && (
                <li>
                  <a
                    href={
                      footer.contact.email.href ??
                      `mailto:${footer.contact.email.value}`
                    }
                    className="text-[13px] text-[--tr-muted] transition hover:text-[--tr-blue]"
                  >
                    {footer.contact.email.value}
                  </a>
                </li>
              )}
              {footer?.contact?.phone && (
                <li className="text-[13px] text-[--tr-muted]">
                  {footer.contact.phone.value}
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-[--tr-hairline] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-[--tr-subtle]">
            © {tenant.name}. Todos los derechos reservados.
          </p>
          {footer?.legal && footer.legal.length > 0 && (
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {footer.legal.map((item) => (
                <li key={item.href}>
                  <LocalizedClientLink
                    href={item.href}
                    className="text-[12px] text-[--tr-subtle] transition hover:text-[--tr-blue]"
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
