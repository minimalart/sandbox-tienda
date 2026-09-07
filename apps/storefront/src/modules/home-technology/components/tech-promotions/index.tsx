import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { TechPromotionsConfig } from "@lib/site-config/types";
import { ArrowUpRight } from "lucide-react";
import { PromoIcon } from "../icons";

/**
 * Bloque de financiación / promociones (Frávega / Best Buy).
 *
 * Sección comercial propia y jerarquizada — no badges sueltos. Cada bloque
 * comunica un beneficio (cuotas, descuentos bancarios, envío, ofertas).
 */
export default function TechPromotions({
  config,
}: {
  config?: TechPromotionsConfig;
}) {
  const blocks = config?.blocks ?? [];
  if (blocks.length === 0) return null;

  return (
    <section className="tech-home bg-[--tech-parchment] py-12 sm:py-16">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="tech-section-title">
            {config?.title ?? "Financiación y promociones"}
          </h2>
          {config?.subtitle && (
            <p className="tech-section-subtitle">{config.subtitle}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {blocks.map((block) => {
            const accent = block.accent ?? "var(--tech-blue)";
            const inner = (
              <>
                <span
                  className="inline-flex size-12 items-center justify-center rounded-2xl bg-white shadow-sm"
                  style={{ color: accent }}
                >
                  <PromoIcon name={block.icon} className="size-6" />
                </span>
                <div>
                  <h3 className="text-[17px] font-semibold leading-snug tracking-tight text-[--tech-ink]">
                    {block.title}
                  </h3>
                  {block.description && (
                    <p className="mt-1 text-[13px] leading-relaxed text-[--tech-muted]">
                      {block.description}
                    </p>
                  )}
                </div>
                {block.href && (
                  <span
                    className="mt-auto inline-flex items-center gap-1 text-[13px] font-semibold"
                    style={{ color: accent }}
                  >
                    Ver más
                    <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                )}
              </>
            );
            const className =
              "group relative flex flex-col gap-3 rounded-3xl border border-[--tech-hairline] p-6 transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]";
            const style = {
              backgroundColor: block.backgroundColor ?? "var(--tech-canvas)",
            };

            return block.href ? (
              <LocalizedClientLink
                key={block.id}
                href={block.href}
                className={className}
                style={style}
              >
                {inner}
              </LocalizedClientLink>
            ) : (
              <div key={block.id} className={className} style={style}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
