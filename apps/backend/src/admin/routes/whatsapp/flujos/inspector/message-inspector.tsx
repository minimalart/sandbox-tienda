import { Text, Textarea } from '@medusajs/ui';
import type { ReactElement } from 'react';

import { WA_LIMITS } from '../lib/graph-contract';
import type { NodeInspectorProps } from './types';

/**
 * El texto que recibe el cliente.
 *
 * El contador no es decoración: WhatsApp corta en 1024 y el servidor rechaza la
 * publicación, así que verlo mientras se escribe es la diferencia entre acortar un
 * párrafo y descubrir el problema al final.
 */
export function MessageInspector({ node, patch }: NodeInspectorProps): ReactElement {
  const body = node.body ?? '';
  const excedido = body.length > WA_LIMITS.body;

  return (
    <label className="flex flex-col gap-y-1">
      <div className="flex items-center justify-between">
        <Text size="xsmall">Texto que recibe el cliente</Text>
        <Text size="xsmall" className={excedido ? 'text-ui-fg-error' : 'text-ui-fg-muted'}>
          {body.length}/{WA_LIMITS.body}
        </Text>
      </div>
      <Textarea rows={4} value={body} onChange={(e) => patch({ body: e.target.value })} />
      <Text size="xsmall" className="text-ui-fg-subtle">
        Podés meter respuestas anteriores: <code>{'{{text}}'}</code> es lo último que escribió, y{' '}
        <code>{'{{answers.id_del_paso}}'}</code> la respuesta de un paso.
      </Text>
    </label>
  );
}

/** Una pregunta abierta no tiene opciones: sólo el texto y el aviso de qué esperar. */
export function AskTextInspector(props: NodeInspectorProps): ReactElement {
  return (
    <div className="flex flex-col gap-y-3">
      <MessageInspector {...props} />
      <Text size="xsmall" className="text-ui-fg-subtle">
        Espera que el cliente ESCRIBA. Lo que responda queda disponible como{' '}
        <code>{'{{text}}'}</code> en la acción que siga.
      </Text>
    </div>
  );
}
