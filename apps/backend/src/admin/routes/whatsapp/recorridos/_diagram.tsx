import { Badge, Text } from '@medusajs/ui';

import type { WaSessionDetail } from '../../../hooks/api/whatsapp-sessions';
import { describeEvent } from './_events';
import { buildStages, eventKind, hhmm, OUTCOME, time, type FlowKind } from './_flow';

/**
 * El recorrido dibujado como un diagrama de flujo vertical: un arranque, una caja
 * por etapa, una flecha entre cajas y un cierre con el desenlace.
 *
 * La lista plana que había antes no mentía, pero tampoco mostraba lo único que se
 * viene a mirar acá: POR DÓNDE pasó la conversación y en qué paso se frenó. Un
 * recorrido son quince eventos con forma de cadena; dibujarlos como cadena es la
 * mitad del trabajo de leerlos.
 */

const KIND: Record<FlowKind, { dot: string; text: string; title: string }> = {
  cliente: { dot: 'bg-ui-tag-blue-icon', text: '', title: 'Lo hizo el cliente' },
  bot: { dot: 'bg-ui-tag-green-icon', text: '', title: 'Lo hizo el bot' },
  sistema: { dot: 'bg-ui-fg-muted', text: 'text-ui-fg-subtle', title: 'Pasó por dentro' },
  alerta: { dot: 'bg-ui-tag-orange-icon', text: '', title: 'Acá se frenan los recorridos' },
  fallo: { dot: 'bg-ui-tag-red-icon', text: 'text-ui-fg-error', title: 'Falló' },
};

/** Los colores del desenlace, para el anillo del cierre. */
const CAP_RING: Record<string, string> = {
  green: 'border-ui-tag-green-icon',
  blue: 'border-ui-tag-blue-icon',
  orange: 'border-ui-tag-orange-icon',
  red: 'border-ui-tag-red-icon',
  grey: 'border-ui-border-strong',
};

/**
 * La flecha entre cajas. Va en un `svg` con `currentColor` y no con bordes de
 * Tailwind para que el triángulo no dependa de que el preset genere las variantes
 * de borde por lado.
 */
const Arrow = () => (
  <svg
    width="11"
    height="24"
    viewBox="0 0 11 24"
    fill="currentColor"
    className="shrink-0 text-ui-fg-muted"
    aria-hidden="true"
  >
    <rect x="5" y="0" width="1" height="17" />
    <path d="M5.5 24 0.5 16.5h10z" />
  </svg>
);

/** El arranque y el cierre: lo redondo marca dónde empieza y dónde termina. */
const Cap = ({ ring, children }: { ring: string; children: React.ReactNode }) => (
  <div className={`rounded-full border-2 bg-ui-bg-base px-4 py-1.5 ${ring}`}>{children}</div>
);

export const JourneyDiagram = ({ detail }: { detail: WaSessionDetail }) => {
  const stages = buildStages(detail.events);
  const outcome = OUTCOME[detail.outcome] ?? { label: detail.outcome, color: 'grey' as const };
  const first = detail.events[0];
  const last = detail.events[detail.events.length - 1];

  if (stages.length === 0) {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        La conversación no registró ningún evento.
      </Text>
    );
  }

  return (
    <div className="flex flex-col items-center gap-y-0 py-2">
      <Cap ring="border-ui-border-strong">
        <div className="flex items-center gap-x-2">
          <span className="h-2 w-2 rounded-full bg-ui-fg-muted" aria-hidden="true" />
          <Text size="xsmall" weight="plus" leading="compact">
            Inicio
          </Text>
          {first && (
            <Text size="xsmall" leading="compact" className="text-ui-fg-subtle">
              {time(first.created_at)}
            </Text>
          )}
        </div>
      </Cap>

      {stages.map((stage, index) => (
        <div key={`${stage.node ?? 'sin-nodo'}-${index}`} className="flex w-full flex-col items-center">
          <Arrow />
          <div className="w-full max-w-xl overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-base">
            {stage.node ? (
              <div className="flex items-center justify-between gap-x-2 border-b border-ui-border-base bg-ui-bg-subtle px-3 py-2">
                <div className="flex min-w-0 items-baseline gap-x-2">
                  <Text size="xsmall" leading="compact" className="shrink-0 text-ui-fg-muted">
                    Paso {stage.step}
                  </Text>
                  <Text size="small" weight="plus" leading="compact" className="truncate font-mono">
                    {stage.node}
                  </Text>
                </div>
                {stage.at && (
                  <Text size="xsmall" leading="compact" className="shrink-0 tabular-nums text-ui-fg-subtle">
                    {hhmm(stage.at)}
                  </Text>
                )}
              </div>
            ) : (
              // Sin nodo no hay encabezado que poner: el asesor y el router no los
              // emiten, y un "Paso —" inventado sería peor que nada.
              <div className="border-b border-ui-border-base bg-ui-bg-subtle px-3 py-2">
                <Text size="xsmall" leading="compact" className="text-ui-fg-muted">
                  Sin paso declarado
                </Text>
              </div>
            )}

            {stage.events.length === 0 ? (
              <div className="px-3 py-2">
                <Text size="xsmall" className="text-ui-fg-muted">
                  Pasó por acá sin registrar nada.
                </Text>
              </div>
            ) : (
              <ol className="flex flex-col">
                {stage.events.map((event) => {
                  const kind = KIND[eventKind(event)];
                  return (
                    <li key={event.id} className="flex items-start gap-x-2 px-3 py-1.5">
                      <span
                        className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${kind.dot}`}
                        title={kind.title}
                        aria-hidden="true"
                      />
                      <Text size="xsmall" className={`min-w-0 flex-1 ${kind.text}`}>
                        {describeEvent(event)}
                      </Text>
                      <Text size="xsmall" className="shrink-0 tabular-nums text-ui-fg-muted">
                        {hhmm(event.created_at)}
                      </Text>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      ))}

      <Arrow />
      <Cap ring={CAP_RING[outcome.color] ?? CAP_RING.grey}>
        <div className="flex items-center gap-x-2">
          <Badge size="2xsmall" color={outcome.color}>
            {outcome.label}
          </Badge>
          {last && (
            <Text size="xsmall" leading="compact" className="text-ui-fg-subtle">
              {hhmm(last.created_at)}
            </Text>
          )}
        </div>
      </Cap>
    </div>
  );
};

/** Qué significa cada punto. Sin esto los colores son decoración. */
export const JourneyLegend = () => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
    {(['cliente', 'bot', 'sistema', 'alerta', 'fallo'] as FlowKind[]).map((kind) => (
      <div key={kind} className="flex items-center gap-x-1.5">
        <span className={`h-2 w-2 rounded-full ${KIND[kind].dot}`} aria-hidden="true" />
        <Text size="xsmall" className="text-ui-fg-subtle">
          {KIND[kind].title}
        </Text>
      </div>
    ))}
  </div>
);
