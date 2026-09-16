import { readTintLine, tintLineText } from "@lib/util/tint-line";

type TintColorLabelProps = {
  /** Metadata de la LÍNEA (carrito u orden). */
  metadata?: Record<string, unknown> | null;
  className?: string;
  "data-testid"?: string;
};

/**
 * Chip con la muestra de color + "Color: Nombre (código)" para una línea
 * entonada. Devuelve `null` cuando la línea no lleva color, así el llamador
 * puede renderizarlo incondicionalmente.
 *
 * Es el MISMO componente en el carrito, en la orden confirmada y en el detalle
 * de la cuenta a propósito: el color es lo único que el comprador eligió de esa
 * pintura y tiene que leerse igual en todo el recorrido.
 */
const TintColorLabel = ({
  metadata,
  className,
  "data-testid": dataTestid = "line-item-tint-color",
}: TintColorLabelProps) => {
  const tint = readTintLine(metadata);
  if (!tint) return null;

  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 ${className ?? ""}`}
      data-testid={dataTestid}
      data-tint-color-code={tint.code || undefined}
    >
      <span
        aria-hidden
        className="inline-block h-3 w-3 shrink-0 rounded-full border border-ui-border-base"
        // Sin hex de la carta va un gris neutro: inventar un color sería
        // mostrarle al cliente una pintura que no es la que va a recibir.
        style={{ backgroundColor: tint.hex ?? "var(--ui-bg-component)" }}
      />
      <span className="truncate">{tintLineText(tint)}</span>
    </span>
  );
};

export default TintColorLabel;
