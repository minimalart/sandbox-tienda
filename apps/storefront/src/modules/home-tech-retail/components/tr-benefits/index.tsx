import type { TechBenefitsConfig } from "@lib/site-config/types";
import { BenefitIcon } from "../icons";

/**
 * Beneficios de compra — bloque institucional con íconos.
 * Envío, retiro, garantía oficial, soporte.
 */
export default function TrBenefits({
  config,
}: {
  config?: TechBenefitsConfig;
}) {
  const items = config?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="tech-retail-home border-y border-[--tr-hairline] bg-white py-8 sm:py-10">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {config?.title && (
          <h2 className="mb-6 text-center text-[clamp(1.125rem,1rem+1vw,1.5rem)] font-extrabold tracking-tight text-[--tr-ink]">
            {config.title}
          </h2>
        )}
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left"
            >
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-[--tr-surface] text-[--tr-blue]">
                <BenefitIcon name={item.icon} className="size-6" />
              </span>
              <div>
                <p className="text-[14px] font-bold tracking-tight text-[--tr-ink]">
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-[12px] leading-snug text-[--tr-muted]">
                    {item.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
