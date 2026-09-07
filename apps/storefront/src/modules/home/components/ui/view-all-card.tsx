import { cn } from "@lib/utils";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { ArrowUpRight } from "lucide-react";

type ViewAllCardProps = {
  href: string;
  title: string;
  subtitle?: string;
  className?: string;
};

/** CTA compartido para cerrar las filas de categorías de la home. */
export default function ViewAllCard({
  href,
  title,
  subtitle,
  className,
}: ViewAllCardProps) {
  return (
    <LocalizedClientLink
      className={cn(
        "flex h-full w-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md",
        className,
      )}
      href={href}
    >
      <div className="text-left">
        <span className="font-semibold text-[#111827] text-[16px] leading-[100%]">
          {title}
        </span>
        {subtitle && (
          <span className="mt-1 block text-gray-500 text-xs">{subtitle}</span>
        )}
      </div>

      <span className="flex size-12 items-center justify-center rounded-full border border-gray-200">
        <ArrowUpRight className="size-5 text-gray-900" />
      </span>
    </LocalizedClientLink>
  );
}
