import type { TechBenefitsConfig } from "@lib/site-config/types";
import { BenefitIcon } from "../icons";

/**
 * Beneficios de compra — bloque institucional con íconos.
 * Envíos, retiro, garantía oficial, pago seguro, atención especializada.
 */
export default function TechBenefits({
  config,
}: {
  config?: TechBenefitsConfig;
}) {
  const items = config?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="tech-home border-y border-[--tech-hairline] bg-[--tech-parchment] py-10 sm:py-12">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {config?.title && (
          <h2 className="mb-8 text-center text-[clamp(1.25rem,1rem+1vw,1.75rem)] font-semibold tracking-tight text-[--tech-ink]">
            {config.title}
          </h2>
        )}
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-white text-[--tech-blue] shadow-sm">
                <BenefitIcon name={item.icon} className="size-6" />
              </span>
              <p className="text-[14px] font-semibold tracking-tight text-[--tech-ink]">
                {item.title}
              </p>
              {item.description && (
                <p className="text-[12px] leading-snug text-[--tech-muted]">
                  {item.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
