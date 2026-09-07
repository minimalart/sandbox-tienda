import {
  getSpecialTemperatures,
  type SpecialTemperatureMode,
} from "@lib/util/transport-condition";
import { cn } from "@/lib/utils";
import { Snowflake } from "lucide-react";

type TransportConditionNoticeProps = {
  /** Items de carrito u orden. */
  items: unknown[];
  /** Variante densa para resúmenes/sidebars. */
  compact?: boolean;
  className?: string;
};

/** Plural en español de cada modo, para armar la frase consolidada. */
const PLURAL: Record<SpecialTemperatureMode, string> = {
  refrigerated: "refrigerados",
  frozen: "congelados",
};

const joinEs = (parts: string[]) =>
  parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;

/**
 * Aviso consolidado de cadena de frío: explica que el pedido incluye productos
 * que requieren transporte especial y CÓMO se transportan. Devuelve null cuando
 * no hay ningún producto especial (todo ambiente).
 */
const TransportConditionNotice = ({
  items,
  compact = false,
  className,
}: TransportConditionNoticeProps) => {
  const modes = getSpecialTemperatures(items);
  if (modes.length === 0) return null;

  const productsLabel = joinEs(modes.map((m) => PLURAL[m]));

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 text-sky-800",
        compact ? "p-2.5 text-xs" : "p-3 text-sm",
        className,
      )}
      data-testid="transport-condition-notice"
    >
      <Snowflake
        aria-hidden="true"
        className={cn("mt-0.5 shrink-0 text-sky-600", compact ? "h-4 w-4" : "h-5 w-5")}
        strokeWidth={2}
      />
      <p className="flex-1">
        Este pedido incluye productos{" "}
        <span className="font-semibold">{productsLabel}</span> que viajan en
        transporte con cadena de frío para conservarlos en óptimas condiciones.
      </p>
    </div>
  );
};

export default TransportConditionNotice;
