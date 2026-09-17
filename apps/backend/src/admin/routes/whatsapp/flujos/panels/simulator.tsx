import { ArrowPath, XMarkMini } from '@medusajs/icons';
import { Button, Input, Text, Textarea } from '@medusajs/ui';
import { useEffect, useRef, useState, type ReactElement } from 'react';

import { actionLabel, type Graph } from '../_editor';
import { WA } from '../lib/skin';
import { ActionPreview } from './action-preview';
import {
  canTimeOut,
  choicesForStep,
  openers,
  type SimSession,
  type SimTurn,
} from '../lib/simulator';

/**
 * PROBAR EL RECORRIDO, con cara de WhatsApp.
 *
 * Hasta acá la única forma de saber si un recorrido funcionaba era PUBLICARLO y
 * escribirle al bot desde un teléfono: probar en producción, con los clientes
 * adentro, y con el recorrido anterior ya reemplazado.
 *
 * Se parece a WhatsApp a propósito y no es decoración: el operador está decidiendo si
 * un texto entra en un botón y si la conversación se entiende, y eso no se puede
 * juzgar en una tabla de pasos. Mientras se prueba, el canvas de atrás enciende el
 * camino recorrido.
 */
export function SimulatorPanel({
  graph,
  session,
  onSendText,
  onTap,
  onContinue,
  onTimeout,
  onReset,
  onClose,
}: {
  graph: Graph;
  session: SimSession;
  onSendText: (text: string) => void;
  onTap: (id: string, label?: string) => void;
  onContinue: (vars?: Record<string, unknown>) => void;
  onTimeout: () => void;
  onReset: () => void;
  onClose: () => void;
}): ReactElement {
  const [draft, setDraft] = useState('');
  const finRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [session.turns.length]);

  const enviar = () => {
    if (!draft.trim()) return;
    onSendText(draft);
    setDraft('');
  };

  const arranques = openers(graph);
  const ultimo = session.turns[session.turns.length - 1];
  const esperaChoice = session.waiting === 'choice' && ultimo?.role === 'bot';

  return (
    <div className="flex w-80 shrink-0 flex-col border-l">
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: WA.tealDeep, color: '#E9EDEF' }}
      >
        <div>
          <Text size="xsmall" weight="plus" style={{ color: '#FFFFFF' }}>
            Probar el recorrido
          </Text>
          <Text size="xsmall" style={{ color: '#C7D3D9' }}>
            No se manda nada ni se toca el carrito
          </Text>
        </div>
        {/* Los íconos van en blanco A MANO: `variant="transparent"` les deja el color
            de texto del admin, que sobre la barra verde oscura es casi invisible. */}
        <div className="flex items-center gap-x-1" style={{ color: '#FFFFFF' }}>
          <button
            type="button"
            aria-label="Empezar de nuevo"
            title="Empezar de nuevo"
            onClick={onReset}
            className="flex items-center rounded p-1 hover:bg-white/15"
          >
            <ArrowPath />
          </button>
          <button
            type="button"
            aria-label="Cerrar la prueba"
            title="Cerrar la prueba"
            onClick={onClose}
            className="flex items-center rounded p-1 hover:bg-white/15"
          >
            <XMarkMini />
          </button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
        style={{ background: 'var(--bg-subtle, #ECE5DD)' }}
      >
        {session.turns.length === 0 && (
          <div className="space-y-2">
            <Text size="xsmall" className="text-ui-fg-subtle">
              Escribí como si fueras el cliente. {arranques.length > 0 && 'O empezá con:'}
            </Text>
            <div className="flex flex-wrap gap-1">
              {arranques.map((palabra) => (
                <Button key={palabra} size="small" variant="secondary" onClick={() => onSendText(palabra)}>
                  {palabra}
                </Button>
              ))}
            </div>
          </div>
        )}

        {session.turns.map((turn, index) => (
          <Turn key={index} turn={turn} graph={graph} session={session} onTap={onTap} />
        ))}

        {session.waiting === 'action' && <ActionControls onContinue={onContinue} />}

        {/**
          * El camino de "no contestó" no se puede provocar de ninguna otra forma: el
          * plazo real es de minutos u horas, y en producción hay que esperar a que un
          * cliente de verdad abandone. Sin este botón, esa rama se publica sin que
          * nadie la haya visto funcionar nunca.
          */}
        {canTimeOut(graph, session) && (
          <div className="pt-1 text-center">
            <Button size="small" variant="transparent" onClick={onTimeout}>
              Simular que no contesta
            </Button>
          </div>
        )}

        {session.waiting === 'ended' && (
          <div className="pt-2 text-center">
            <Text size="xsmall" className="text-ui-fg-subtle">
              El recorrido terminó.
            </Text>
            <Button size="small" variant="secondary" className="mt-1" onClick={onReset}>
              Empezar de nuevo
            </Button>
          </div>
        )}

        <div ref={finRef} />
      </div>

      <div className="flex items-center gap-x-2 border-t p-2">
        <Input
          size="small"
          placeholder={esperaChoice ? 'O escribí la respuesta…' : 'Escribí un mensaje…'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              enviar();
            }
          }}
        />
        <Button size="small" onClick={enviar} disabled={!draft.trim()}>
          Enviar
        </Button>
      </div>
    </div>
  );
}

function Turn({
  turn,
  graph,
  session,
  onTap,
}: {
  turn: SimTurn;
  graph: Graph;
  session: SimSession;
  onTap: (id: string, label?: string) => void;
}): ReactElement {
  if (turn.role === 'client') {
    return (
      <div className="flex justify-end">
        <Bubble background={WA.sentLight}>{turn.text}</Bubble>
      </div>
    );
  }

  if (turn.role === 'system') {
    return (
      <div className="rounded-md border border-dashed bg-ui-bg-base p-2">
        {turn.kind === 'action' && turn.step?.kind === 'run_tool' ? (
          <div className="flex flex-col gap-y-2">
            <div>
              <Text size="xsmall" weight="plus">
                Acción: {actionLabel(turn.step.tool)}
              </Text>
              {Object.entries(turn.step.args).length > 0 && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {Object.entries(turn.step.args)
                    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                    .join(' · ')}
                </Text>
              )}
            </div>
            {/**
              * Las acciones de sólo lectura se CORREN contra el catálogo real y se
              * dibuja lo que el cliente recibiría. Las que tocan el carrito o generan
              * un pago siguen describiéndose: la vista previa dice cuál es cuál.
              */}
            <ActionPreview tool={turn.step.tool} args={turn.step.args} onTap={onTap} />
          </div>
        ) : (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {turn.message}
          </Text>
        )}
      </div>
    );
  }

  const step = turn.step;

  if (step.kind === 'ask_buttons' || step.kind === 'ask_list') {
    const opciones = choicesForStep(graph, session, step);
    return (
      <div className="space-y-1">
        <Bubble background="#FFFFFF">{step.body}</Bubble>
        <div className="flex flex-col gap-y-1">
          {opciones.length === 0 && (
            <Text size="xsmall" className="text-ui-fg-error">
              Esta pregunta sale sin ninguna opción: WhatsApp la rechaza.
            </Text>
          )}
          {opciones.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onTap(option.id, option.label)}
              className="rounded-md border bg-ui-bg-base px-2 py-1 text-center hover:bg-ui-bg-base-hover"
            >
              <Text size="xsmall" className="text-ui-fg-interactive">
                {option.label}
              </Text>
              {option.description && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {option.description}
                </Text>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Sólo los pasos que MANDAN un texto se dibujan como burbuja. Una acción o una
  // derivación llegan como tarjeta de sistema y nunca caen acá.
  if (step.kind !== 'send_text' && step.kind !== 'ask_text') return <></>;

  return (
    <div className="flex justify-start">
      <Bubble background="#FFFFFF">{step.body}</Bubble>
    </div>
  );
}

const Bubble = ({ background, children }: { background: string; children: React.ReactNode }) => (
  <div
    className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-2 py-1"
    style={{ background, color: '#0B141A', fontSize: 12, lineHeight: 1.35 }}
  >
    {children}
  </div>
);

/**
 * Lo que la acción habría dejado.
 *
 * Sin esto, todo lo que vive detrás de una acción —que es la mitad del recorrido— no
 * se puede probar: la pregunta siguiente sale vacía porque sus opciones venían de una
 * variable que nadie escribió, y el camino de compra no arranca porque nadie tocó un
 * producto.
 */
function ActionControls({ onContinue }: { onContinue: (vars?: Record<string, unknown>) => void }): ReactElement {
  const [vars, setVars] = useState('');
  const [error, setError] = useState<string | null>(null);

  const seguir = () => {
    if (!vars.trim()) {
      onContinue();
      return;
    }
    try {
      const parsed = JSON.parse(vars) as Record<string, unknown>;
      setError(null);
      onContinue(parsed);
      setVars('');
    } catch {
      setError('Eso no es un JSON válido.');
    }
  };

  return (
    <div className="space-y-2 rounded-md border bg-ui-bg-base p-2">
      <Text size="xsmall" weight="plus">
        ¿Qué habría dejado la acción?
      </Text>
      <Textarea
        rows={2}
        placeholder={'{"presentations": [{"value": "20l", "label": "20 L"}]}'}
        value={vars}
        onChange={(e) => setVars(e.target.value)}
      />
      {error && (
        <Text size="xsmall" className="text-ui-fg-error">
          {error}
        </Text>
      )}
      <Text size="xsmall" className="text-ui-fg-subtle">
        Opcional. Sirve para las preguntas que sacan sus respuestas de una variable. Para simular que
        el cliente tocó un producto, escribí <code>variant_123</code> abajo y mandalo.
      </Text>
      <Button size="small" variant="secondary" onClick={seguir}>
        Continuar
      </Button>
    </div>
  );
}
