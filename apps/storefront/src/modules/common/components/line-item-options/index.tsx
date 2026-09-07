import type { HttpTypes } from "@medusajs/types";
import { Text } from "@medusajs/ui";

type LineItemOptionsProps = {
  variant: HttpTypes.StoreProductVariant | undefined;
  /**
   * Metadata de la LÍNEA. Cuando trae `tint` (base entonada del sistema
   * tintométrico) se muestra el color en lugar de la variante: para una pintura
   * entonada "Variante: Único" no dice nada y el color es TODO lo que el cliente
   * eligió.
   */
  metadata?: Record<string, unknown> | null;
  "data-testid"?: string;
  "data-value"?: HttpTypes.StoreProductVariant;
};

type TintMetadata = {
  color_name?: unknown;
  color_code?: unknown;
  color_hex?: unknown;
};

const readTint = (metadata: Record<string, unknown> | null | undefined) => {
  const tint = metadata?.tint as TintMetadata | undefined;
  if (!tint || typeof tint !== "object") return null;
  const name = typeof tint.color_name === "string" ? tint.color_name : "";
  const code = typeof tint.color_code === "string" ? tint.color_code : "";
  if (!name && !code) return null;
  return {
    label: name || code,
    code,
    hex: typeof tint.color_hex === "string" ? tint.color_hex : null,
  };
};

const LineItemOptions = ({
  variant,
  metadata,
  "data-testid": dataTestid,
  "data-value": dataValue,
}: LineItemOptionsProps) => {
  const tint = readTint(metadata);

  if (tint) {
    return (
      <Text
        className="txt-medium inline-flex w-full items-center gap-1.5 overflow-hidden text-ellipsis text-ui-fg-subtle"
        data-testid={dataTestid}
        data-value={dataValue}
      >
        <span
          aria-hidden
          className="inline-block h-3 w-3 shrink-0 rounded-full border border-ui-border-base"
          // Sin hex de la carta va un gris neutro: inventar un color sería
          // mostrarle al cliente una pintura que no es la que va a recibir.
          style={{ backgroundColor: tint.hex ?? "var(--ui-bg-component)" }}
        />
        <span className="truncate">
          Color: {tint.label}
          {tint.code && tint.label !== tint.code ? ` (${tint.code})` : ""}
        </span>
      </Text>
    );
  }

  return (
    <Text
      className="txt-medium inline-block w-full overflow-hidden text-ellipsis text-ui-fg-subtle"
      data-testid={dataTestid}
      data-value={dataValue}
    >
      Variante: {variant?.title}
    </Text>
  );
};

export default LineItemOptions;
