import { Input, Switch, Text } from '@medusajs/ui';
import type { ReactElement } from 'react';

import { getActiveSiteSnapshot } from '../../../../lib/active-site';

/**
 * LA CONFIGURACIÓN DEL RECORRIDO.
 *
 * Vivía en una columna fija a la derecha, siempre abierta, con tres párrafos de
 * explicación que ocupaban un cuarto de la pantalla y que nadie vuelve a leer después
 * de la primera vez. Son dos ajustes que se tocan una vez cada mucho: van detrás de la
 * rueda dentada, y el lugar que ocupaban se lo queda el canvas, que es el producto de
 * esta pantalla.
 *
 * De la descripción larga queda una sola línea: de qué tienda es este recorrido. Esa
 * sí hay que saberla antes de tocar nada — alguien puede estar editando el recorrido
 * de TODAS las tiendas creyendo que toca el de una.
 */
export function FlowSettings({
  siteId,
  activeVersion,
  publishedAt,
  exclusive,
  onExclusiveChange,
  notes,
  onNotesChange,
}: {
  siteId: string | null;
  activeVersion: number | null;
  publishedAt: string | null;
  exclusive: boolean;
  onExclusiveChange: (value: boolean) => void;
  notes: string;
  onNotesChange: (value: string) => void;
}): ReactElement {
  const site = getActiveSiteSnapshot();

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-1">
        <Text size="xsmall" weight="plus">
          Alcance
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {siteId
            ? `Este recorrido es de ${site?.name ?? 'esta tienda'} y sólo lo usa ella.`
            : 'Este es el recorrido general: lo usan todas las tiendas que no tengan uno propio.'}
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {activeVersion !== null
            ? `Publicado: versión ${activeVersion}${publishedAt ? `, el ${new Date(publishedAt).toLocaleDateString()}` : ''}.`
            : 'Todavía no se publicó: el bot sigue atendiendo como antes.'}
        </Text>
      </div>

      <label className="flex items-start gap-x-2 border-t pt-5">
        {/* `shrink-0`: en un flex con el texto al lado se comprime hasta ser un punto. */}
        <Switch className="shrink-0" checked={exclusive} onCheckedChange={onExclusiveChange} />
        <span>
          <Text size="xsmall" weight="plus">
            Este recorrido atiende todo
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Lo que no salga por acá NO cae al bot anterior ni a la IA: se responde con el menú. Se
            aplica al publicar, y se revierte publicando de nuevo sin la marca.
          </Text>
        </span>
      </label>

      <label className="flex flex-col gap-y-1 border-t pt-5">
        <Text size="xsmall" weight="plus">
          Qué cambió
        </Text>
        <Input
          size="small"
          placeholder="Agregué el camino de devoluciones"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
        <Text size="xsmall" className="text-ui-fg-subtle">
          Queda guardado con la versión que publiques. Es lo que después deja entender el historial
          y elegir a cuál volver.
        </Text>
      </label>
    </div>
  );
}
