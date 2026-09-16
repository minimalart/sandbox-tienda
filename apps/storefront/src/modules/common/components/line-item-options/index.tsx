import type { HttpTypes } from "@medusajs/types";
import { Text } from "@medusajs/ui";

import TintColorLabel from "@modules/common/components/tint-color-label";
import { readTintLine } from "@lib/util/tint-line";

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

const LineItemOptions = ({
  variant,
  metadata,
  "data-testid": dataTestid,
  "data-value": dataValue,
}: LineItemOptionsProps) => {
  if (readTintLine(metadata)) {
    return (
      <Text
        className="txt-medium w-full overflow-hidden text-ellipsis text-ui-fg-subtle"
        data-testid={dataTestid}
        data-value={dataValue}
      >
        <TintColorLabel className="w-full" metadata={metadata} />
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
