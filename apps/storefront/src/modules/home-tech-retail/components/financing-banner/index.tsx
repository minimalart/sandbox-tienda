import type { TrFinancingConfig } from "@lib/site-config/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { ArrowUpRight } from "lucide-react";
import { PromoIcon } from "../icons";

/**
 * Financiación y promociones (FinancingBanner) — bloque propio del template.
 *
 * En tecnología retail la financiación vende tanto como el precio: cuotas,
 * descuentos bancarios y promociones jerarquizadas. Cada plan resalta un número
 * grande de cuotas o un ícono de beneficio.
 */
export default function FinancingBanner({
  config,
}: {
  config?: TrFinancingConfig;
}) {
  const plans = config?.plans ?? [];
  if (plans.length === 0) return null;

  return (
    <section className="tech-retail-home bg-white py-10 sm:py-12">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="tr-section-title">
            {config?.title ?? "Financiación y promociones"}
          </h2>
          {config?.subtitle && (
            <p className="tr-section-subtitle">{config.subtitle}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const accent = plan.accent ?? "var(--tr-blue)";
            const inner = (
              <>
                <div className="flex items-center gap-3">
                  {plan.highlight ? (
                    <span
                      className="text-[44px] font-extrabold leading-none tracking-tight"
                      style={{ color: accent }}
                    >
                      {plan.highlight}
                    </span>
                  ) : (
                    <span
                      className="inline-flex size-12 items-center justify-center rounded-xl bg-white shadow-sm"
                      style={{ color: accent }}
                    >
                      <PromoIcon name={plan.icon} className="size-6" />
                    </span>
                  )}
                  <div>
                    <h3 className="text-[16px] font-bold leading-snug tracking-tight text-[--tr-ink]">
                      {plan.title}
                    </h3>
                  </div>
                </div>
                {plan.description && (
                  <p className="text-[13px] leading-relaxed text-[--tr-muted]">
                    {plan.description}
                  </p>
                )}
                {plan.href && (
                  <span
                    className="mt-auto inline-flex items-center gap-1 text-[13px] font-bold"
                    style={{ color: accent }}
                  >
                    Ver más
                    <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                )}
              </>
            );
            const className =
              "group relative flex flex-col gap-3 rounded-2xl border border-[--tr-hairline] p-5 transition hover:-translate-y-0.5 hover:shadow-md";
            const style = {
              backgroundColor: plan.backgroundColor ?? "var(--tr-surface)",
            };

            return plan.href ? (
              <LocalizedClientLink
                key={plan.id}
                href={plan.href}
                className={className}
                style={style}
              >
                {inner}
              </LocalizedClientLink>
            ) : (
              <div key={plan.id} className={className} style={style}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
