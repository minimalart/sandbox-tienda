import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Container, Heading, Select, Text } from '@medusajs/ui';
import { useState } from 'react';

import { ExtensionVersion } from '../../../components/common/extension-version';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { useWhatsappSession, useWhatsappSessions } from '../../../hooks/api/whatsapp-sessions';
import { whatsappLabel } from '../../../translations/whatsapp';
import { JourneyDiagram, JourneyLegend } from './_diagram';
import { OUTCOME, time } from './_flow';

/**
 * Los recorridos de los clientes por el bot: la lista de conversaciones angosta a
 * la izquierda, el recorrido del seleccionado dibujado como diagrama de flujo
 * vertical a la derecha.
 *
 * El ancho está repartido al revés que en `erp/logs` a propósito. Lo que se viene a
 * mirar acá no es la lista —una conversación se elige por teléfono y desenlace, que
 * entran en 22rem— sino la cadena: por dónde pasó y en qué paso se frenó. El
 * diagrama se queda con el resto.
 */

const Recorridos = () => {
  const [days, setDays] = useState(7);
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useWhatsappSessions(days);
  const { data: detail } = useWhatsappSession(selected);

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="flex items-center justify-between">
        <div>
          <Heading level="h2">{whatsappLabel('NAV_JOURNEYS')}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Qué camino hizo cada cliente, dónde se frenó y en qué paso falló.
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <Select.Trigger className="w-32">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="1">Último día</Select.Item>
              <Select.Item value="7">7 días</Select.Item>
              <Select.Item value="30">30 días</Select.Item>
            </Select.Content>
          </Select>
          <ExtensionVersion extension="whatsapp" />
          <HelpDrawer slug="whatsapp" />
        </div>
      </Container>

      <div className="flex items-start gap-x-3">
        <Container className="w-[22rem] shrink-0 overflow-hidden p-0">
          {isLoading ? (
            <div className="p-4">
              <Text size="small">Cargando…</Text>
            </div>
          ) : (data?.sessions.length ?? 0) === 0 ? (
            <div className="p-4">
              <Text size="small" className="text-ui-fg-subtle">
                No hubo conversaciones en este período.
              </Text>
            </div>
          ) : (
            <ul className="max-h-[calc(100vh-13rem)] overflow-y-auto">
              {data?.sessions.map((session) => {
                const outcome = OUTCOME[session.outcome];
                const active = selected === session.session_id;
                return (
                  <li key={session.session_id}>
                    {/* Un botón y no una fila clickeable: esta lista se recorre con el
                        teclado tanto como con el mouse. */}
                    <button
                      type="button"
                      aria-current={active}
                      onClick={() => setSelected(session.session_id)}
                      className={`flex w-full flex-col gap-y-1 border-b border-ui-border-base px-3 py-2 text-left hover:bg-ui-bg-base-hover ${
                        active ? 'bg-ui-bg-highlight' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-x-2">
                        <Text size="small" weight="plus" leading="compact" className="truncate">
                          {session.phone}
                        </Text>
                        <Text
                          size="xsmall"
                          leading="compact"
                          className="shrink-0 tabular-nums text-ui-fg-subtle"
                        >
                          {time(session.last_at)}
                        </Text>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        <Badge size="2xsmall" color={outcome?.color ?? 'grey'}>
                          {outcome?.label ?? session.outcome}
                        </Badge>
                        {session.used_ai && <Badge size="2xsmall">IA</Badge>}
                        <Text size="xsmall" leading="compact" className="text-ui-fg-muted">
                          {session.nodes > 0 ? `${session.nodes} pasos` : `${session.events} eventos`}
                        </Text>
                      </div>
                      {session.legacy && (
                        <Text size="xsmall" leading="compact" className="text-ui-fg-muted">
                          sin sesión (anterior al fix de correlación)
                        </Text>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Container>

        <Container className="min-w-0 flex-1">
          {!detail ? (
            <Text size="small" className="text-ui-fg-subtle">
              Tocá una conversación para ver su recorrido.
            </Text>
          ) : (
            <div className="flex flex-col gap-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <Text size="small" weight="plus">
                    {detail.phone}
                  </Text>
                  {detail.path.length > 0 && (
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      Camino: {detail.path.join(' → ')}
                    </Text>
                  )}
                </div>
                <JourneyLegend />
              </div>
              <div className="max-h-[calc(100vh-17rem)] overflow-y-auto">
                <JourneyDiagram detail={detail} />
              </div>
            </div>
          )}
        </Container>
      </div>
    </div>
  );
};

export default Recorridos;

export const config = defineRouteConfig({ label: whatsappLabel('NAV_JOURNEYS'), rank: 4 });

export const handle = { breadcrumb: () => whatsappLabel('NAV_JOURNEYS') };
