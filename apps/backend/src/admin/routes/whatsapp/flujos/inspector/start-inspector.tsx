import { Input, Switch, Text } from '@medusajs/ui';
import type { ReactElement } from 'react';

import type { NodeInspectorProps } from './types';

const lista = (value: string[] | undefined): string => (value ?? []).join(', ');
const desdeLista = (value: string): string[] | undefined => {
  const items = value
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
};

/**
 * QUÉ DESPIERTA ESTA ENTRADA.
 *
 * `exact` no estaba en el editor aunque el motor ya lo leía, y es la diferencia entre
 * un saludo y una pregunta: con `keywords: ['hola']`, "Hola! ¿Tienen sucursales en
 * CABA?" entraba por el saludo —"hola" está adentro— y el cliente recibía el menú en
 * vez de una respuesta. Un saludo sólo es un saludo cuando el mensaje no dice nada
 * más.
 */
export function StartInspector({ node, patch }: NodeInspectorProps): ReactElement {
  const match = node.match ?? {};
  const set = (patchMatch: Partial<typeof match>) => {
    const next = { ...match, ...patchMatch };
    for (const key of Object.keys(next) as Array<keyof typeof next>) {
      if (next[key] === undefined) delete next[key];
    }
    patch({ match: Object.keys(next).length ? next : undefined });
  };

  return (
    <div className="flex flex-col gap-y-3">
      <label className="flex flex-col gap-y-1">
        <Text size="xsmall">El mensaje dice EXACTAMENTE (separados por coma)</Text>
        <Input
          size="small"
          placeholder="hola, buenas, menu"
          value={lista(match.exact)}
          onChange={(e) => set({ exact: desdeLista(e.target.value) })}
        />
        <Text size="xsmall" className="text-ui-fg-subtle">
          Para los saludos. Se compara el mensaje entero, sin tildes ni signos: “¡Hola!” entra,
          “Hola, tienen pintura?” no.
        </Text>
      </label>

      <label className="flex flex-col gap-y-1">
        <Text size="xsmall">El mensaje MENCIONA (separadas por coma)</Text>
        <Input
          size="small"
          placeholder="sucursales, devolución"
          value={lista(match.keywords)}
          onChange={(e) => set({ keywords: desdeLista(e.target.value) })}
        />
        <Text size="xsmall" className="text-ui-fg-subtle">
          Alcanza con que la palabra aparezca en cualquier parte del mensaje.
        </Text>
      </label>

      <label className="flex items-start gap-x-2">
        {/* `shrink-0`: en un flex con el texto al lado, se comprime hasta ser un punto. */}
        <Switch
          className="shrink-0"
          checked={match.fallback === true}
          onCheckedChange={(checked) => set({ fallback: checked ? true : undefined })}
        />
        <span>
          <Text size="xsmall" weight="plus">
            Atender lo que no coincida con ninguna otra
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Tiene que haber exactamente una entrada así, o el recorrido no se puede publicar. Ojo
            con ponerla en el saludo: se tragaría todo el texto libre y el cliente recibiría el menú
            en vez de una respuesta.
          </Text>
        </span>
      </label>
    </div>
  );
}

/** El motivo con el que se deriva. Lo ve el equipo, no el cliente. */
export function HandoffInspector({ node, patch }: NodeInspectorProps): ReactElement {
  return (
    <label className="flex flex-col gap-y-1">
      <Text size="xsmall">Motivo de la derivación</Text>
      <Input
        size="small"
        placeholder="lo pidió el cliente"
        value={node.reason ?? ''}
        onChange={(e) => patch({ reason: e.target.value })}
      />
      <Text size="xsmall" className="text-ui-fg-subtle">
        Queda en la conversación para que quien atienda sepa por qué le llegó.
      </Text>
    </label>
  );
}
