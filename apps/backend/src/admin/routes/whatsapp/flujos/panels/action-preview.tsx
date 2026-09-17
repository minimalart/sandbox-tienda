import { Text } from '@medusajs/ui';
import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { sdk } from '../../../../lib/client';

/**
 * LO QUE EL CLIENTE VA A VER, con los productos de verdad.
 *
 * La prueba mostraba una tarjeta que describía la acción: "Buscar productos · query:
 * remera". Sirve para entender el dibujo, y no sirve para lo que uno quiere saber
 * antes de publicar — si la búsqueda encuentra algo, si los productos tienen foto, si
 * el título entra en la tarjeta y si el precio se lee. Eso sólo se ve corriendo la
 * búsqueda contra el catálogo real, que es lo que hace `preview-action` con las mismas
 * funciones que usa el bot en producción.
 *
 * Y las tarjetas son TOCABLES: el botón manda el `variant_id`, igual que el carrusel
 * de WhatsApp, así que tocar un producto acá hace avanzar el recorrido exactamente
 * como lo haría el cliente. Antes, para probar ese camino —el que más plata mueve—
 * había que escribir a mano `variant_123` en un campo.
 */

type PreviewCard = {
  id: string;
  title: string;
  price: number | null;
  image_url: string | null;
  in_stock: boolean;
  /** Cuántas presentaciones tiene el producto detrás de esta tarjeta. */
  variant_count?: number;
};

type PreviewResponse =
  | { kind: 'cards'; currency_code: string; cards: PreviewCard[] }
  | { kind: 'unsupported'; reason: string };

const plata = (valor: number | null, moneda: string): string => {
  if (valor === null || Number.isNaN(valor)) return '';
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda }).format(valor);
  } catch {
    return `${valor}`;
  }
};

export function ActionPreview({
  tool,
  args,
  onTap,
}: {
  tool: string;
  args: Record<string, unknown>;
  onTap: (variantId: string, label?: string) => void;
}): ReactElement {
  const { data, isFetching } = useQuery({
    // Los args entran en la clave: cambiar lo que busca el paso tiene que volver a
    // consultar, o la prueba mostraría el resultado de la búsqueda anterior.
    queryKey: ['whatsapp-flujos', 'preview-accion', tool, JSON.stringify(args)],
    queryFn: () =>
      sdk.client.fetch<PreviewResponse>('/admin/whatsapp-flows/preview-action', {
        method: 'POST',
        body: { tool, args },
      }),
    // Una vista previa no se reintenta sola: si el catálogo falla, se dice y listo.
    retry: false,
  });

  if (isFetching && !data) {
    return (
      <Text size="xsmall" className="text-ui-fg-subtle">
        Buscando en el catálogo…
      </Text>
    );
  }

  if (!data || data.kind === 'unsupported') {
    return (
      <Text size="xsmall" className="text-ui-fg-subtle">
        {data?.reason ?? 'No se pudo consultar el catálogo.'}
      </Text>
    );
  }

  if (data.cards.length === 0) {
    return (
      <Text size="xsmall" className="text-ui-fg-error">
        {/* Es EL hallazgo que justifica la vista previa: el recorrido está bien
            dibujado y aun así el cliente no ve nada. */}
        La búsqueda no encontró ningún producto. El cliente recibiría un mensaje sin
        opciones.
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-y-2">
      <Text size="xsmall" className="text-ui-fg-subtle">
        Así lo ve el cliente ({data.cards.length}
        {data.cards.length === 1 ? ' producto' : ' productos'}). Tocá uno para seguir.
      </Text>

      {/* Carrusel horizontal, como el de WhatsApp: se ve una tarjeta y media, que es
          lo que le dice al cliente que hay más al costado. */}
      <div className="flex gap-x-2 overflow-x-auto pb-1">
        {data.cards.map((card) => (
          <div
            key={card.id}
            className="flex w-40 shrink-0 flex-col overflow-hidden rounded-lg border bg-ui-bg-base"
          >
            {card.image_url ? (
              <img src={card.image_url} alt={card.title} className="h-24 w-full object-cover" />
            ) : (
              // Sin foto, WhatsApp no arma el carrusel y cae a una lista de texto: el
              // hueco marcado es lo que hace ver POR QUÉ va a pasar eso.
              <div className="flex h-24 w-full items-center justify-center bg-ui-bg-component">
                <Text size="xsmall" className="text-ui-fg-muted">
                  sin foto
                </Text>
              </div>
            )}
            <div className="flex flex-1 flex-col gap-y-1 p-2">
              <Text size="xsmall" className="line-clamp-2 leading-tight">
                {card.title}
              </Text>
              <Text size="xsmall" weight="plus">
                {plata(card.price, data.currency_code)}
                {!card.in_stock && ' · sin stock'}
              </Text>
              {/* Una tarjeta por PRODUCTO: si tiene varias presentaciones, el precio
                  que se ve es el de la que el bot ofrece primero, y elegir cuál es un
                  paso aparte. Decirlo acá evita la sorpresa. */}
              {(card.variant_count ?? 1) > 1 && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {card.variant_count} presentaciones
                </Text>
              )}
              <button
                type="button"
                onClick={() => onTap(card.id, card.title)}
                className="mt-auto rounded-md border py-1 text-center text-xs hover:bg-ui-bg-base-hover"
              >
                Agregar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
