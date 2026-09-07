import {
  getItemTransportDisplay,
  type TemperatureMode,
  TRANSPORT_CONDITION_CONFIG,
} from "@lib/util/transport-condition";
import { cn } from "@/lib/utils";
import { Snowflake } from "lucide-react";

type TransportConditionBadgeProps = {
  /** Line item de carrito u orden; se resuelve la temperatura internamente. */
  item?: unknown;
  /** Alternativa: pasar el modo ya resuelto. */
  mode?: TemperatureMode;
  /** Tamaño visual. 'sm' para listados/áreas densas. */
  size?: "sm" | "md";
  /** Solo ícono (para superficies muy compactas, ej. listado de órdenes). */
  iconOnly?: boolean;
  className?: string;
};

/**
 * Marca un producto que requiere transporte especial (refrigerado/congelado).
 * Devuelve null cuando el producto es de temperatura ambiente (no se señaliza).
 */
const TransportConditionBadge = ({
  item,
  mode,
  size = "md",
  iconOnly = false,
  className,
}: TransportConditionBadgeProps) => {
  const display =
    mode && mode !== "ambient"
      ? TRANSPORT_CONDITION_CONFIG[mode]
      : getItemTransportDisplay(item);

  if (!display) return null;

  const sizing =
    size === "sm"
      ? "gap-1 px-2 py-0.5 text-[10px]"
      : "gap-1 px-2.5 py-0.5 text-xs";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border font-semibold leading-none",
        sizing,
        display.badgeClassName,
        className,
      )}
      title={display.description}
      data-testid="transport-condition-badge"
    >
      <Snowflake aria-hidden="true" className={iconSize} strokeWidth={2} />
      {!iconOnly && <span>{display.label}</span>}
    </span>
  );
};

export default TransportConditionBadge;
