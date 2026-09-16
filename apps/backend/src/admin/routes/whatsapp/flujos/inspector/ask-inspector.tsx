import { Trash } from '@medusajs/icons';
import { Button, IconButton, Input, Text } from '@medusajs/ui';
import type { ReactElement } from 'react';

import { maxOptions, optionsOf } from '../_editor';
import { WA_LIMITS } from '../lib/graph-contract';
import { MessageInspector } from './message-inspector';
import type { NodeInspectorProps } from './types';

/**
 * LAS RESPUESTAS DE UNA PREGUNTA.
 *
 * Eran DOS campos por opción: "valor" y "lo que ve el cliente". El primero era un id
 * interno disfrazado de dato — dejarlo vacío rompía la arista, y cambiarlo después de
 * cablear la despegaba en silencio. Ahora se escribe UNA cosa, la que ve el cliente,
 * y el id lo pone el editor.
 *
 * Cada opción tiene su propio conector en la tarjeta, así que acá no hay que decir a
 * qué opción corresponde cada flecha: se ve en el canvas.
 */
export function AskInspector(props: NodeInspectorProps): ReactElement {
  const { node, patch, addOption, patchOption, removeOption } = props;
  const options = optionsOf(node);
  const tope = maxOptions(node.type);
  const lleno = options.length >= tope;
  const labelMax = node.type === 'ask_buttons' ? WA_LIMITS.buttonLabel : WA_LIMITS.rowTitle;

  return (
    <div className="flex flex-col gap-y-4">
      <MessageInspector {...props} />

      <div className="flex flex-col gap-y-2">
        <Text size="xsmall">
          {node.type === 'ask_buttons' ? `Respuestas (hasta ${tope} botones)` : `Respuestas (hasta ${tope} filas)`}
        </Text>

        {options.length === 0 && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Sin respuestas, la pregunta no se puede mandar: WhatsApp la rechaza.
          </Text>
        )}

        {options.map((option) => {
          const largo = (option.label ?? '').length;
          return (
            <div key={option.value} className="flex flex-col gap-y-1">
              <div className="flex items-center gap-x-1">
                <Input
                  size="small"
                  placeholder="lo que ve el cliente"
                  value={option.label}
                  onChange={(e) => patchOption(option.value, { label: e.target.value })}
                />
                <IconButton
                  size="small"
                  variant="transparent"
                  aria-label="Quitar esta respuesta"
                  onClick={() => removeOption(option.value)}
                >
                  <Trash />
                </IconButton>
              </div>
              {largo > labelMax && (
                <Text size="xsmall" className="text-ui-fg-error">
                  WhatsApp corta en {labelMax} caracteres y este tiene {largo}.
                </Text>
              )}
              {node.type === 'ask_list' && (
                <Input
                  size="small"
                  placeholder="descripción (opcional)"
                  value={option.description ?? ''}
                  onChange={(e) => patchOption(option.value, { description: e.target.value || undefined })}
                />
              )}
            </div>
          );
        })}

        <Button size="small" variant="secondary" disabled={lleno} onClick={addOption}>
          Agregar respuesta
        </Button>
        {lleno && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            WhatsApp acepta {tope} en este tipo de paso. Para más respuestas, usá una pregunta de
            lista o encadená otra pregunta.
          </Text>
        )}
      </div>

      {node.type === 'ask_list' && (
        <label className="flex flex-col gap-y-1">
          <Text size="xsmall">Texto del botón que abre la lista</Text>
          <Input
            size="small"
            placeholder="Ver opciones"
            value={node.listButton ?? ''}
            onChange={(e) => patch({ listButton: e.target.value || undefined })}
          />
          {(node.listButton ?? '').length > WA_LIMITS.listButton && (
            <Text size="xsmall" className="text-ui-fg-error">
              Máximo {WA_LIMITS.listButton} caracteres.
            </Text>
          )}
        </label>
      )}

      {/**
        * RESPUESTAS QUE NO SE PUEDEN DIBUJAR.
        *
        * Medio recorrido real depende de datos: las presentaciones del producto que el
        * cliente acaba de elegir, sus pedidos, las terminaciones disponibles. Nada de
        * eso se sabe al dibujar.
        */}
      <div className="flex flex-col gap-y-1 border-t pt-3">
        <Text size="xsmall">Respuestas que llegan en vivo (opcional)</Text>
        <Input
          size="small"
          placeholder="vars.presentations"
          value={node.optionsFrom ?? ''}
          onChange={(e) => patch({ optionsFrom: e.target.value || undefined })}
        />
        <Text size="xsmall" className="text-ui-fg-subtle">
          Poné acá dónde dejó las respuestas el paso anterior. Van ANTES de las que escribiste, que
          quedan de salida de emergencia. Si no entran todas, se recortan las de la variable — nunca
          las escritas.
        </Text>
        {node.optionsFrom && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Lo que el cliente elija de esa lista sale por el conector “Otras respuestas”, porque
            ninguna flecha puede nombrar una respuesta que todavía no existe.
          </Text>
        )}
      </div>
    </div>
  );
}
