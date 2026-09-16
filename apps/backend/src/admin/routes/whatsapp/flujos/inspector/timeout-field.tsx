import { Select, Switch, Text } from '@medusajs/ui';
import type { ReactElement } from 'react';

import { FLOW_TIMEOUT_MAX_SECONDS, WAITING_NODE_TYPES } from '../lib/graph-contract';
import type { NodeInspectorProps } from './types';

/**
 * CUÁNTO ESPERA ESTA PREGUNTA ANTES DE SEGUIR SOLA.
 *
 * Un recorrido que pregunta se queda parado hasta que el cliente conteste. Si no
 * contesta —abre el chat, ve la pregunta y se va— la conversación queda colgada para
 * siempre: nadie vuelve a mirarla hasta que esa persona escriba, y si escribe tres
 * meses después, el bot le responde como si la pregunta siguiera en pie.
 *
 * Prendiendo el plazo, el paso gana una salida más en el canvas —"Si no contesta"—
 * y lo que va ahí lo decide quien dibuja: insistir una vez, ofrecer una persona, o
 * cerrar la conversación con un saludo.
 */

/**
 * Los plazos que se ofrecen, en segundos.
 *
 * Es una lista y no un campo numérico libre porque la decisión real es gruesa —"un
 * ratito" contra "más tarde"— y un input abierto invita a escribir 45 segundos, que
 * en WhatsApp es apurar a alguien que está escribiendo.
 */
const OPCIONES: ReadonlyArray<{ value: string; label: string }> = [
  { value: '60', label: '1 minuto' },
  { value: '300', label: '5 minutos' },
  { value: '900', label: '15 minutos' },
  { value: '1800', label: '30 minutos' },
  { value: '3600', label: '1 hora' },
  { value: '10800', label: '3 horas' },
  { value: String(FLOW_TIMEOUT_MAX_SECONDS), label: '6 horas' },
];

const DEFAULT_SECONDS = 900;

export function TimeoutField({ node, patch }: NodeInspectorProps): ReactElement | null {
  // Sólo los pasos que esperan una respuesta pueden quedarse esperando.
  if (!WAITING_NODE_TYPES.has(node.type)) return null;

  const activo = Boolean(node.timeout_seconds);
  // Un plazo cargado a mano que no esté en la lista igual se tiene que poder ver.
  const opciones = OPCIONES.some((o) => o.value === String(node.timeout_seconds))
    ? OPCIONES
    : [...OPCIONES, { value: String(node.timeout_seconds), label: `${node.timeout_seconds} segundos` }];

  return (
    <div className="flex flex-col gap-y-2 border-t pt-3">
      <label className="flex items-start gap-x-2">
        {/* `shrink-0`: en un flex con el texto al lado se comprime hasta ser un punto. */}
        <Switch
          className="shrink-0"
          checked={activo}
          onCheckedChange={(checked) =>
            patch({ timeout_seconds: checked ? DEFAULT_SECONDS : undefined })
          }
        />
        <span>
          <Text size="xsmall" weight="plus">
            Seguir solo si no contesta
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Sin esto, una conversación abandonada se queda esperando para siempre.
          </Text>
        </span>
      </label>

      {activo && (
        <>
          <Select
            value={String(node.timeout_seconds)}
            onValueChange={(value) => patch({ timeout_seconds: Number(value) })}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {opciones.map((opcion) => (
                <Select.Item key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Text size="xsmall" className="text-ui-fg-subtle">
            El paso gana la salida “Si no contesta”: conectala a lo que quieras que pase.
            Más de 6 horas no se puede — la conversación se archiva sola a las 12 y el
            recorrido ya no estaría ahí.
          </Text>
        </>
      )}
    </div>
  );
}
