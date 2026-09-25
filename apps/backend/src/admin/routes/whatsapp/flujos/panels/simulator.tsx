import { ArrowPath, XMarkMini } from '@medusajs/icons';
import { Button, Input, Text, Textarea } from '@medusajs/ui';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';

import { actionLabel, type Graph } from '../_editor';
import { WA } from '../lib/skin';
import { ActionPreview, type PreviewResult } from './action-preview';
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
  onActionVars,
  onTimeout,
  onReset,
  onClose,
}: {
  graph: Graph;
  session: SimSession;
  onSendText: (text: string) => void;
  onTap: (id: string, label?: string) => void;
  onContinue: (vars?: Record<string, unknown>) => void;
  /** Escribe en `vars` lo que la acción habría dejado, sin avanzar el turno. */
  onActionVars: (vars: Record<string, unknown>) => void;
  onTimeout: () => void;
  onReset: () => void;
  onClose: () => void;
}): ReactElement {
  const [draft, setDraft] = useState('');
  const finRef = useRef<HTMLDivElement | null>(null);

  /**
   * Lo que la última acción habría dejado en `vars`.
   *
   * Lo trae la vista previa, que ya corrió la búsqueda de verdad contra el catálogo.
   * Antes esa información moría en la tarjeta: se veían los productos y la pregunta
   * siguiente salía igual de vacía, porque `vars` seguía sin nada. El operador tenía
   * que copiar los ids de variante a mano dentro de un JSON — y para eso hay que saber
   * los ids, que no están a la vista en ningún lado.
   */
  const [dejado, setDejado] = useState<PreviewResult | null>(null);
  /** Qué se aplicó ya, para no volver a escribir lo mismo en cada render. */
  const aplicado = useRef<string | null>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    // Cada turno nuevo invalida lo de la acción anterior: si no, se aplicarían los
    // resultados de una búsqueda vieja.
    setDejado(null);
    aplicado.current = null;
  }, [session.turns.length]);

  /**
   * En cuanto la vista previa contesta, la variable se escribe SOLA.
   *
   * Es lo que hace la acción en producción, y la razón de que sea automático es que
   * una acción `silent` no pausa: cuando la vista previa contesta, la pregunta que
   * consume esa variable YA está dibujada en pantalla. Pedir un click ahí sería pedirlo
   * para completar algo que el operador no eligió ni tiene por qué entender.
   */
  const recibirPreview = useCallback(
    (result: PreviewResult) => {
      setDejado(result);
      if (!result.saveAs) return;
      const firma = `${session.turns.length}:${result.saveAs}:${typeof result.value === 'string' ? result.value : result.value.length}`;
      if (aplicado.current === firma) return;
      aplicado.current = firma;
      onActionVars({ [result.saveAs]: result.value });
    },
    [onActionVars, session.turns.length],
  );

  const enviar = () => {
    if (!draft.trim()) return;
    onSendText(draft);
    setDraft('');
  };

  const arranques = openers(graph);
  const ultimaAccion = session.turns.reduce(
    (found, turn, index) => (turn.role === 'system' && turn.kind === 'action' ? index : found),
    -1,
  );
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
          <Turn
            key={index}
            turn={turn}
            graph={graph}
            session={session}
            onTap={onTap}
            // Sólo la ÚLTIMA acción completa `vars`. No se puede pedir que sea el
            // último turno: una acción `silent` deja la pregunta siguiente dibujada
            // abajo suyo en el mismo turno, que es el caso más común de todos.
            {...(index === ultimaAccion ? { onResult: recibirPreview } : {})}
          />
        ))}

        {session.waiting === 'action' && <ActionControls dejado={dejado} onContinue={onContinue} />}

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
  onResult,
}: {
  turn: SimTurn;
  graph: Graph;
  session: SimSession;
  onTap: (id: string, label?: string) => void;
  onResult?: (result: PreviewResult) => void;
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
            <ActionPreview
              tool={turn.step.tool}
              args={turn.step.args}
              onTap={onTap}
              {...(onResult ? { onResult } : {})}
            />
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
 * SEGUIR DESPUÉS DE UNA ACCIÓN.
 *
 * Todo lo que vive detrás de una acción es la mitad del recorrido, y era la mitad que
 * no se podía probar: la acción no se ejecuta en la prueba, así que la pregunta
 * siguiente salía sin opciones —las suyas venían de una variable que nadie escribió— y
 * la única salida era que el operador tipeara a mano un JSON con los ids de variante
 * adentro. Para eso hay que saber los ids, y los ids no están a la vista en ningún
 * lado: la prueba se terminaba ahí.
 *
 * Ahora las trae la vista previa, que YA corrió la búsqueda de sólo lectura contra el
 * catálogo real. "Continuar" escribe eso mismo en `vars` y el recorrido sigue solo. El
 * campo de JSON queda para el caso raro —una variable que ninguna acción produce— y
 * ahora está guardado, no al frente.
 */
function ActionControls({
  dejado,
  onContinue,
}: {
  dejado: PreviewResult | null;
  onContinue: (vars?: Record<string, unknown>) => void;
}): ReactElement {
  const [vars, setVars] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [avanzado, setAvanzado] = useState(false);

  const saveAs = dejado?.saveAs ?? null;
  const options = Array.isArray(dejado?.value) ? dejado.value : [];
  // La consulta de pedido deja un TEXTO, no opciones: decir "0 opciones" sería mentir.
  const dejoTexto = typeof dejado?.value === 'string';

  const seguir = () => {
    // Lo que la acción habría publicado ya se escribió solo en cuanto contestó la
    // vista previa: acá sólo se avanza, con lo escrito a mano si lo hay.
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
      {saveAs && options.length > 0 && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          La acción dejó {options.length}
          {options.length === 1 ? ' opción' : ' opciones'} en <code>vars.{saveAs}</code>: el
          paso siguiente ya las tiene.
        </Text>
      )}

      {/* El hallazgo que justifica la prueba: el recorrido está bien dibujado y la
          pregunta siguiente igual va a salir vacía. Verlo acá es verlo antes de
          publicar. */}
      {saveAs && dejoTexto && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          La acción dejó su respuesta en <code>vars.{saveAs}</code>: el paso siguiente la
          muestra.
        </Text>
      )}

      {saveAs && !dejoTexto && options.length === 0 && (
        <Text size="xsmall" className="text-ui-fg-error">
          La acción no deja nada en <code>vars.{saveAs}</code>: el paso siguiente no va a
          tener ninguna opción que mostrar.
        </Text>
      )}

      {!saveAs && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Esta acción le habla al cliente ella misma. Continuá para ver por dónde sigue el
          recorrido.
        </Text>
      )}

      <div className="flex items-center gap-x-2">
        <Button size="small" variant="secondary" onClick={seguir}>
          Continuar
        </Button>
        <Button size="small" variant="transparent" onClick={() => setAvanzado((v) => !v)}>
          {avanzado ? 'Ocultar variables' : 'Escribir variables a mano'}
        </Button>
      </div>

      {avanzado && (
        <div className="space-y-1">
          <Textarea
            rows={2}
            placeholder={'{"presentations": [{"value": "variant_123", "label": "20 L"}]}'}
            value={vars}
            onChange={(e) => setVars(e.target.value)}
          />
          {error && (
            <Text size="xsmall" className="text-ui-fg-error">
              {error}
            </Text>
          )}
          <Text size="xsmall" className="text-ui-fg-subtle">
            Sólo hace falta para una variable que ninguna acción produce: lo que la acción
            deja se escribe solo.
          </Text>
        </div>
      )}
    </div>
  );
}
