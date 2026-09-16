/**
 * Widget de colores entonados en el detalle de orden.
 *
 * Zona: `order.details.after`
 *
 * POR QUÉ EXISTE: el color que eligió el comprador viaja en `metadata.tint` de
 * la línea, y la línea además se guarda con `subtitle` "Color: X (código)"
 * justamente para que el admin lo mostrara sin tocar nada. No lo muestra: el
 * summary de orden de Medusa 2.18 pinta `title`, `variant_sku` y las opciones de
 * la variante, y nada más — `subtitle` sólo aparece en los formularios de
 * order-edit, claim y exchange. Verificado en
 * `@medusajs/dashboard/src/routes/orders/order-detail/components/order-summary-section`.
 *
 * El NOMBRE del color ya no depende de esta tarjeta: desde `tintLineTitle`
 * (`modules/erp/tinting/line-metadata.ts`) el alta de la línea lo escribe dentro
 * de `title`, que es el único campo de la línea que el summary sí renderiza. Lo
 * que esta tarjeta agrega es el resto: la muestra de color y, sobre todo,
 * `cod_formula` y `cod_base` — los dos códigos que el operador carga en la
 * máquina tintométrica, los mismos que el outbox le manda al ERP. Tenerlos a la
 * vista permite comparar contra Zeus sin salir de la orden.
 *
 * DÓNDE APARECE: no lo decide el `zone`. Los sufijos `.before`/`.after` son
 * legacy y el layout composer de 2.18 los descarta — todos los widgets de
 * `order.details*` caen en la misma sección y el orden lo define cada usuario
 * por drag & drop, con la opción de guardarlo como default de la tienda
 * (`useLayoutPreference`, scope `default`). Cambiar el string de acá no mueve
 * nada.
 *
 * NO hace fetch propio (a diferencia de `order-erp-widget`): `metadata` es una
 * columna de la línea y el admin ya pide `*items`, así que llega hidratada en
 * `data`. Si algún día dejara de llegar, el widget devuelve `null` — nunca
 * rompe el detalle de orden.
 *
 * NO lo posee ninguna extensión, igual que el resto de la UI tintométrica (ver
 * `apps/storefront/src/modules/tinting/**`): no importa nada del módulo `erp`,
 * lee metadata que ya está en la orden y sin líneas entonadas no renderiza.
 */

import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { DetailWidgetProps } from '@medusajs/framework/types';
import { Container, Heading, Text } from '@medusajs/ui';

type AdminOrderLine = {
  id: string;
  title?: string | null;
  product_title?: string | null;
  variant_title?: string | null;
  quantity?: number | null;
  metadata?: Record<string, unknown> | null;
};

type AdminOrder = { id: string; items?: AdminOrderLine[] };

type TintLine = {
  id: string;
  product: string;
  quantity: number;
  colorLabel: string;
  hex: string | null;
  codFormula: string;
  codBase: string;
};

/**
 * Lectura tolerante de `metadata.tint`. Se lee a mano y no con
 * `readTintMetadata` del módulo `erp` porque esto es un bundle de admin (Vite),
 * no el build del server: importar desde `src/modules` arrastraría el módulo
 * entero al bundle del panel.
 */
function readTintLine(item: AdminOrderLine): TintLine | null {
  const tint = item.metadata?.tint as Record<string, unknown> | undefined;
  if (!tint || typeof tint !== 'object') return null;

  const name = typeof tint.color_name === 'string' ? tint.color_name : '';
  const code = typeof tint.color_code === 'string' ? tint.color_code : '';
  if (!name && !code) return null;

  const label = name || code;
  const suffix = code && label !== code ? ` (${code})` : '';
  const hex = typeof tint.color_hex === 'string' ? tint.color_hex : null;

  return {
    id: item.id,
    product: item.product_title || item.title || item.id,
    quantity: Number(item.quantity) || 0,
    colorLabel: `${label}${suffix}`,
    // Sin hex de la carta va un gris neutro: inventar un color sería mostrarle
    // al operador una pintura que no es la que va a preparar.
    hex: hex && /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : null,
    codFormula: typeof tint.cod_formula === 'string' ? tint.cod_formula : '',
    codBase: typeof tint.cod_base === 'string' ? tint.cod_base : '',
  };
}

const OrderTintingWidget = ({ data }: DetailWidgetProps<AdminOrder>) => {
  const lines = (data?.items ?? [])
    .map(readTintLine)
    .filter((line): line is TintLine => line !== null);

  // Sin líneas entonadas el widget no existe: una tarjeta vacía en toda orden
  // de toda tienda sería ruido permanente para tapar un caso puntual.
  if (lines.length === 0) return null;

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Colores entonados</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {lines.length === 1 ? '1 línea' : `${lines.length} líneas`}
        </Text>
      </div>

      {lines.map((line) => (
        <div className="flex items-start gap-x-3 px-6 py-4" key={line.id}>
          {/*
            Sin hex conocido NO va un `style` con una variable CSS a mano: la que
            existe en el panel es la clase de Tailwind del preset de Medusa. Un
            `var()` inventado se resuelve a nada y el swatch queda transparente.
          */}
          <span
            aria-hidden
            className={`mt-1 inline-block h-4 w-4 shrink-0 rounded-full border border-ui-border-base${
              line.hex ? '' : ' bg-ui-bg-component'
            }`}
            style={line.hex ? { backgroundColor: line.hex } : undefined}
          />
          <div className="min-w-0">
            <Text size="small" leading="compact" className="text-ui-fg-base">
              {line.product}
              {line.quantity > 1 ? ` · ${line.quantity} u.` : ''}
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              {line.colorLabel}
            </Text>
            {(line.codFormula || line.codBase) && (
              <Text size="xsmall" className="text-ui-fg-muted">
                {[
                  line.codFormula ? `Fórmula ${line.codFormula}` : '',
                  line.codBase ? `Base ${line.codBase}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            )}
          </div>
        </div>
      ))}
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: 'order.details.after',
});

export default OrderTintingWidget;
