import { Select, Text, Textarea } from '@medusajs/ui';
import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { sdk } from '../../../../lib/client';
import type { NodeInspectorProps } from './types';

/**
 * QUÉ AGENTE ATIENDE ESTE PASO.
 *
 * Un recorrido sabe llevar una conversación con forma —menú, pregunta, rama— y hay
 * tramos que no la tienen: "contame qué problema tenés con el producto" no se resuelve
 * con tres botones. Hasta acá la única forma de que hablara un agente era que NINGUNA
 * Entrada matcheara y el turno se cayera al asistente: o sea, por accidente, y para
 * el resto de la conversación.
 *
 * Acá se lo cita a propósito, en un punto concreto, y contesta una sola vez: el turno
 * siguiente vuelve al recorrido por la salida del paso.
 */

type AgenteLite = { id: string; key: string; name: string; description?: string | null; enabled?: boolean };

export function AgentInspector({ node, patch }: NodeInspectorProps): ReactElement {
  /**
   * Los agentes salen del asistente, que es donde se crean y se configuran. Acá sólo
   * se elige uno: duplicar su configuración en el editor de recorridos sería tener dos
   * lugares donde cambiar las instrucciones de la misma persona artificial.
   */
  const { data: agentes = [], isLoading } = useQuery({
    queryKey: ['whatsapp-flujos', 'agentes'],
    queryFn: async () => {
      const { agents } = await sdk.client.fetch<{ agents: AgenteLite[] }>(
        '/admin/ai-assistant/agents',
        { method: 'GET' },
      );
      return (agents ?? []).filter((a) => a.enabled !== false);
    },
  });

  const elegido = agentes.find((a) => a.key === node.agent_key);
  // Un agente que ya no existe no se puede esconder: el paso quedaría mudo en
  // producción y en el editor se vería un select vacío, sin decir por qué.
  const opciones = elegido || !node.agent_key ? agentes : [...agentes, { id: node.agent_key, key: node.agent_key, name: `${node.agent_key} (ya no existe)` }];

  return (
    <div className="flex flex-col gap-y-3">
      <label className="flex flex-col gap-y-1">
        <Text size="xsmall">Agente</Text>
        <Select value={node.agent_key ?? ''} onValueChange={(value) => patch({ agent_key: value })}>
          <Select.Trigger>
            <Select.Value placeholder={isLoading ? 'Cargando…' : 'Elegí un agente'} />
          </Select.Trigger>
          <Select.Content>
            {opciones.map((agente) => (
              <Select.Item key={agente.key} value={agente.key}>
                {agente.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        {elegido?.description && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {elegido.description}
          </Text>
        )}
        {!isLoading && agentes.length === 0 && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            No hay agentes configurados. Se crean en Asistente.
          </Text>
        )}
      </label>

      <label className="flex flex-col gap-y-1">
        <Text size="xsmall">De qué se ocupa acá (opcional)</Text>
        <Textarea
          rows={3}
          placeholder="Contestá sólo sobre plazos y costos de envío. Si pregunta otra cosa, decile que en un momento lo ayudamos."
          value={node.body ?? ''}
          onChange={(e) => patch({ body: e.target.value })}
        />
        <Text size="xsmall" className="text-ui-fg-subtle">
          {/* El agente ya tiene sus instrucciones generales; esto ACOTA el paso. Sin
              acotarlo, un agente amplio se lleva la conversación para cualquier lado y
              el recorrido pierde el hilo que venía llevando. */}
          Se suma a las instrucciones del agente, sólo para este paso. Sirve para que no
          se vaya de tema.
        </Text>
      </label>

      <Text size="xsmall" className="border-t pt-3 text-ui-fg-subtle">
        Contesta una vez y el recorrido sigue por la salida de este paso. Puede usar las
        herramientas que tenga habilitadas en Asistente.
      </Text>
    </div>
  );
}
