import { getActiveTenant } from "@lib/site-config/active-tenant";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import "../../fashion-theme.css";

/**
 * Footer del template Moda — inspirado en COS.
 *
 * Simple, elegante y con mucho aire: columnas de navegación en mayúsculas
 * espaciadas, contacto, redes (como texto) y una línea legal sobria. El
 * contenido sale de `assets.fashion.footer` + la navegación del header.
 */
export default async function FashionFooter() {
  const tenant = await getActiveTenant();
  const fashion = tenant.assets.fashion;
  const footer = fashion?.footer;
  const nav = fashion?.header?.nav ?? [];

  return (
    <footer className="fashion-home border-t border-[--f-hairline] bg-[color:var(--footer-bg,var(--f-canvas))] text-[--f-ink]">
      <div className="mx-auto max-w-[1600px] px-6 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          {/* Marca */}
          <div className="col-span-2 sm:col-span-1">
            <p className="f-display text-2xl">{tenant.name}</p>
            {footer?.description && (
              <p className="mt-4 max-w-xs text-[13px] font-light leading-relaxed text-[--f-muted]">
                {footer.description}
              </p>
            )}
          </div>

          {/* Tienda */}
          {nav.length > 0 && (
            <div>
              <p className="f-eyebrow mb-5">Tienda</p>
              <ul className="space-y-3">
                {nav.map((item) => (
                  <li key={item.id}>
                    <LocalizedClientLink
                      href={item.href}
                      className="text-[13px] text-[--f-muted] transition hover:text-[--f-ink]"
                    >
                      {item.name}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ayuda */}
          <div>
            <p className="f-eyebrow mb-5">Ayuda</p>
            <ul className="space-y-3">
              <li>
                <LocalizedClientLink
                  href="/account"
                  className="text-[13px] text-[--f-muted] transition hover:text-[--f-ink]"
                >
                  Mi cuenta
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/store"
                  className="text-[13px] text-[--f-muted] transition hover:text-[--f-ink]"
                >
                  Tienda
                </LocalizedClientLink>
              </li>
              {footer?.legal?.map((item) => (
                <li key={item.href}>
                  <LocalizedClientLink
                    href={item.href}
                    className="text-[13px] text-[--f-muted] transition hover:text-[--f-ink]"
                  >
                    {item.name}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto + redes */}
          <div>
            <p className="f-eyebrow mb-5">Contacto</p>
            <ul className="space-y-3">
              {footer?.contact?.email && (
                <li>
                  <a
                    href={
                      footer.contact.email.href ??
                      `mailto:${footer.contact.email.value}`
                    }
                    className="text-[13px] text-[--f-muted] transition hover:text-[--f-ink]"
                  >
                    {footer.contact.email.value}
                  </a>
                </li>
              )}
              {footer?.social?.map((s) => (
                <li key={s.name}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] text-[--f-muted] transition hover:text-[--f-ink]"
                  >
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 border-t border-[--f-hairline] pt-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[--f-subtle]">
            © {tenant.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
