/**
 * El lado sucio del intérprete: toma el plan que devolvió `advance()` y lo ejecuta
 * contra WhatsApp, las tools y la sesión.
 *
 * La división es la misma que `advisor/engine.ts` ↔ `advisor/flow.ts`: acá vive
 * todo lo que necesita un contenedor, una promesa o una fila de base, y por eso
 * este archivo NO tiene lógica de decisión. Si algo de acá tiene un `if` sobre el
 * grafo, está en el archivo equivocado.
 */

import type { MedusaContainer } from '@medusajs/framework/types';

import { runWhatsappNativeTool } from '../../../modules/ai-assistant/ai/native-tools/whatsapp-tools';
import type WhatsappAgentModuleService from '../../../modules/whatsapp-agent/service';
import { getActiveFlow } from '../../../modules/whatsapp-flow/cache';
import { readWaBotSwitch } from '../bot-switch';
import { trackWaEvent } from '../events';
import {
  sendWhatsappButtons,
  sendWhatsappList,
  sendWhatsappText,
} from '../send-whatsapp-text';
import { toolHandledTurn } from './tool-spoke';
import {
  advance,
  flowTapId,
  readState,
  renderText,
  resolveNodeOptions,
  type FlowInput,
  type FlowState,
  type FlowStep,
} from './engine';

type AnyRecord = Record<string, unknown>;

export type FlowTurnInput = {
  container: MedusaContainer;
  waSvc: WhatsappAgentModuleService | null;
  phone: string;
  sessionId: string | null;
  siteId: string | null;
  text: string | null;
  selectionId: string | null;
  /**
   * El turno lo dispara el barrido de esperas vencidas y no un mensaje: nadie
   * escribió nada, venció el plazo del paso donde la conversación quedó.
   */
  timedOut?: boolean;
  /**
   * Si el bot de esta tienda está encendido, cuando el caller YA lo preguntó.
   *
   * Sin esto se lee acá. Es a propósito que el default sea preguntar y no asumir
   * que sí: el interruptor se agregó gateando el webhook, y el barrido de plazos
   * vencidos —que es el OTRO caller, y manda mensajes sin que nadie escriba— se
   * quedó afuera. El bot apagado seguía despertando conversaciones cada minuto.
   *
   * El gate vive acá, en el punto por donde pasan los dos, y no en cada caller:
   * un caller nuevo hereda el gate en vez de heredar el agujero.
   */
  botEnabled?: boolean;
  /**
   * Cómo se le pregunta a un agente del asistente. Sin esto, un paso de tipo agente
   * no contesta y el recorrido sigue de largo — que es lo correcto para un caller que
   * no tiene con qué armarle el contexto.
   */
  askAgent?: (opts: {
    agentKey: string;
    message: string;
    context: string | null;
  }) => Promise<string | null>;
};

/** Mismo contrato de una línea que el router: `true` = el turno quedó resuelto. */
export type FlowTurnResult = {
  handled: boolean;
  /**
   * `true` cuando hay un grafo activo marcado como exclusivo. El caller lo usa
   * para saber que NO tiene que caer al router ni al modelo, aunque el turno no
   * haya quedado resuelto.
   */
  exclusive: boolean;
};

const NOT_HANDLED: FlowTurnResult = { handled: false, exclusive: false };

/**
 * Ejecuta un paso. Devuelve `false` si el envío falló.
 *
 * Un fallo de envío NO se traga en silencio: sin el evento, un interactivo que Meta
 * rechaza deja al cliente sin respuesta y al operador sin nada que mirar — el mismo
 * agujero que hoy tienen `send()` y `sendMainMenu` del router viejo.
 */
async function runStep(input: FlowTurnInput, step: FlowStep, state: FlowState): Promise<boolean> {
  const { container, phone } = input;

  /**
   * Las opciones se vuelven a resolver ACÁ y no se usan las del plan.
   *
   * `advance()` arma el plan entero de una y recién después se ejecuta paso por
   * paso. Una acción SILENCIOSA que publica opciones —"estas son las
   * presentaciones del producto que elegiste"— corre DESPUÉS de que el plan se
   * armó, así que en el plan esa pregunta salió vacía. Volver a resolver contra el
   * estado vivo es lo que deja escribir "buscá las presentaciones y preguntá cuál
   * quiere" como dos nodos seguidos, que es como está escrito el recorrido.
   *
   * No es una decisión sobre el grafo: la regla vive en `resolveNodeOptions`, que
   * es pura y del motor. Acá sólo se la llama con datos frescos.
   */
  const freshOptions = (optionsFrom: string | undefined) =>
    optionsFrom
      ? resolveNodeOptions(
          { id: step.nodeId, type: step.kind === 'ask_buttons' ? 'ask_buttons' : 'ask_list', optionsFrom, options: [] },
          state,
        )
      : null;

  /**
   * El CUERPO se vuelve a resolver acá, por lo mismo que las opciones.
   *
   * El plan se arma entero antes de ejecutar nada, así que un `{{vars.…}}` que
   * escribe una acción SILENCIOSA de este mismo turno todavía no existía cuando se
   * renderizó el texto — y `renderText` reemplaza lo desconocido por VACÍO, que es
   * lo correcto para no mostrarle el andamio al cliente y lo peor posible para un
   * link.
   *
   * Es el bug que mató la venta en el último paso del recorrido de compra: el
   * cierre decía "Abrí el enlace 👇" y el enlace no estaba, porque
   * `wa_checkout_link` lo publica DESPUÉS. `optionsFrom` ya tenía resuelto este
   * problema para las opciones; a los cuerpos nadie se lo había extendido.
   *
   * Sin `template` —el texto del nodo no tenía nada que resolver— se manda el del
   * plan, byte por byte como antes.
   */
  const freshBody = (step: { body: string; template?: string }): string =>
    step.template === undefined
      ? step.body
      : renderText(step.template, state, {
          text: input.text,
          selectionId: input.selectionId,
          ...(input.timedOut ? { timedOut: true } : {}),
        });

  const track = (type: 'send_failed' | 'node_entered', payload: AnyRecord) =>
    trackWaEvent(container, {
      phone,
      type,
      payload,
      usedAi: false,
      sessionId: input.sessionId,
      siteId: input.siteId,
    });

  try {
    switch (step.kind) {
      // `ask_text` sale igual que un mensaje: la diferencia está en el motor, que
      // se queda esperando lo que el cliente escriba.
      case 'ask_text':
      case 'send_text': {
        const sent = await sendWhatsappText(phone, freshBody(step));
        if (!sent) track('send_failed', { node_id: step.nodeId, kind: 'text' });
        return Boolean(sent);
      }

      case 'ask_buttons': {
        const live = freshOptions(step.optionsFrom);
        const buttons = live
          ? live.map((o) => ({ id: flowTapId(step.nodeId, o.value), label: o.label }))
          : step.buttons;
        // Una pregunta sin NINGUNA opción no se manda: WhatsApp la rechaza y el
        // fallback a texto dejaría un "¿cuál querés?" sin nada que elegir.
        if (buttons.length === 0) {
          track('send_failed', { node_id: step.nodeId, kind: 'buttons', empty: true });
          return false;
        }
        const sent = await sendWhatsappButtons({
          to: phone,
          body: freshBody(step),
          buttons: buttons.map((b) => ({ id: b.id, title: b.label })),
        });
        if (sent) return true;
        // Fallback a texto: mejor una pregunta sin botones que un turno mudo.
        track('send_failed', { node_id: step.nodeId, kind: 'buttons' });
        const options = buttons.map((b, i) => `${i + 1}. ${b.label}`).join('\n');
        return Boolean(await sendWhatsappText(phone, `${freshBody(step)}\n\n${options}`));
      }

      case 'ask_list': {
        const live = freshOptions(step.optionsFrom);
        const rows = live
          ? live.map((o) => ({ id: flowTapId(step.nodeId, o.value), title: o.label, description: o.description }))
          : step.rows;
        if (rows.length === 0) {
          track('send_failed', { node_id: step.nodeId, kind: 'list', empty: true });
          return false;
        }
        const sent = await sendWhatsappList({
          to: phone,
          body: freshBody(step),
          button: step.button,
          rows,
        });
        if (sent) return true;
        track('send_failed', { node_id: step.nodeId, kind: 'list' });
        const options = rows.map((r, i) => `${i + 1}. ${r.title}`).join('\n');
        return Boolean(await sendWhatsappText(phone, `${freshBody(step)}\n\n${options}`));
      }

      case 'run_tool': {
        /**
         * EL ACUSE DE QUE LA TOOL HABLÓ, y no lo que devuelve.
         *
         * Las tools devuelven texto PARA EL MODELO —"No encontré productos, pedile
         * que lo nombre de otra forma"— porque nacieron para el agente. En un
         * recorrido NO HAY modelo: ese texto no lo lee nadie. Tomar la devolución
         * como "turno atendido" dejaba al bot MUDO justo cuando más importa decir
         * algo: una búsqueda sin resultados, un carrusel que Meta rechaza, una
         * cantidad inválida. El cliente escribía el nombre de un producto y no
         * volvía nada, para siempre.
         *
         * `sentUserMessage` es el acuse bueno porque las tools lo prenden dentro del
         * `if (sent)`, o sea exactamente cuando el mensaje salió. Si no habló, el
         * recorrido cede el turno y contesta el router o el modelo — que es la red
         * anti-silencio que ya existe.
         */
        const toolCtx: AnyRecord = {
          container,
          waPhone: phone,
          waUsedAi: false,
          waSessionId: input.sessionId,
          waSiteId: input.siteId,
          // El grafo decidió llamar a esta tool: los guardarraíles que existen para
          // contener al modelo (no agregar sin selección explícita) no aplican.
          isVariantSelection: true,
          // El bolsillo donde una acción publica opciones para la pregunta que
          // sigue. Es el MISMO objeto que se persiste al final del turno, así que
          // lo que escriba acá sobrevive al turno y lo ve `resolveNodeOptions`.
          waFlowVars: state.vars,
          // `silent` viaja como "ya le hablé al cliente en este turno", que es la
          // señal que las tools ya respetan para no encimar mensajes. Así el nodo
          // puede quedarse con la confirmación y dibujar él los botones que siguen.
          sentUserMessage: step.silent,
        };
        const out = await runWhatsappNativeTool(step.tool, step.args, toolCtx as never);
        const atendido = toolHandledTurn({
          returned: out,
          silent: step.silent,
          spoke: toolCtx.sentUserMessage === true,
        });
        // Queda en el embudo: una acción que no habla es un hueco del recorrido, y
        // sin este evento el único síntoma es que el cliente no recibe nada.
        if (!atendido) {
          track('send_failed', { node_id: step.nodeId, kind: 'tool_muda', tool: step.tool, out });
        }
        return atendido;
      }

      case 'run_agent': {
        /**
         * El agente es un SEAM y no un import: acá no se sabe —ni se tiene por qué
         * saber— cómo se arma su contexto (el cliente, sus pedidos, el historial, el
         * RAG). Todo eso ya lo construye el webhook para su propia caída al agente, y
         * se pasa como función para no construirlo dos veces ni construirlo cuando
         * ningún recorrido usa un agente.
         */
        if (!input.askAgent) {
          track('send_failed', { node_id: step.nodeId, kind: 'agent', reason: 'sin_puente' });
          return false;
        }
        const reply = await input.askAgent({
          agentKey: step.agentKey,
          message: step.message,
          context: step.context ?? null,
        });
        // Un agente que no contesta no puede dejar al cliente sin respuesta ni
        // voltear el turno: se registra y el recorrido sigue por su arista.
        if (!reply || !reply.trim()) {
          track('send_failed', { node_id: step.nodeId, kind: 'agent', reason: 'sin_respuesta' });
          return false;
        }
        return Boolean(await sendWhatsappText(phone, reply.trim()));
      }

      case 'handoff': {
        const out = await runWhatsappNativeTool(
          'wa_handoff_to_human',
          { reason: step.reason },
          {
            container,
            waPhone: phone,
            waUsedAi: false,
            waSessionId: input.sessionId,
            waSiteId: input.siteId,
          } as never,
        );
        return out !== undefined;
      }

      default:
        return false;
    }
  } catch {
    track('send_failed', { node_id: step.nodeId, kind: step.kind, threw: true });
    return false;
  }
}

/**
 * Atiende un turno con el grafo publicado.
 *
 * Devuelve `{ handled: false }` —y no toca nada— cuando no hay grafo activo, cuando
 * ningún `start` matcheó, o cuando el grafo está roto. El caller sigue con lo que
 * tenía. Que un grafo mal dibujado deje al bot mudo sería cambiar un problema de
 * configuración por una caída.
 */
export async function runFlowTurn(input: FlowTurnInput): Promise<FlowTurnResult> {
  const { container, waSvc, phone } = input;
  if (!waSvc) return NOT_HANDLED;

  /**
   * EL INTERRUPTOR, antes de mirar el grafo.
   *
   * Se sale sin tocar la sesión, y eso es deliberado: el plazo vencido queda como
   * está, así que apagar el bot PAUSA el recorrido en vez de cancelarlo, y la
   * conversación sigue donde quedó cuando alguien lo vuelva a prender. Persistir el
   * estado acá sería consumir el vencimiento en silencio.
   *
   * El costo es que el barrido vuelve a encontrarla cada minuto mientras el bot esté
   * apagado. Es una consulta que ya estaba haciendo igual: lo caro sería mandar el
   * mensaje, y eso es justamente lo que no pasa.
   */
  const botEnabled = input.botEnabled ?? (await readWaBotSwitch(container, input.siteId)).enabled;
  if (!botEnabled) return NOT_HANDLED;

  const active = await getActiveFlow(container, undefined, input.siteId);
  if (!active) return NOT_HANDLED;
  const exclusive = active.exclusive;

  const session = (await waSvc.getSession(phone)) as unknown as AnyRecord;
  const state = readState(session, active.versionId);

  const turn: FlowInput = {
    text: input.text,
    selectionId: input.selectionId,
    ...(input.timedOut ? { timedOut: true } : {}),
  };
  const plan = advance(active.graph, state, turn);

  if (!plan.handled || plan.steps.length === 0) {
    // Ceder el turno NO es una falla. Un grafo que hace de puerta de entrada
    // —atiende el saludo y el menú, y suelta el carrito al router y el texto libre
    // al modelo— pasa por acá en CADA turno de una conversación sana; registrarlo
    // como `error` pintaba el embudo de rojo y escondía las fallas de verdad.
    // `broken_graph` sí es una: hay una arista mal dibujada.
    const broken = plan.reason === 'broken_graph';
    trackWaEvent(container, {
      phone,
      type: broken ? 'error' : 'flow_passthrough',
      payload: { where: 'flow', reason: plan.reason, version_id: active.versionId },
      usedAi: false,
      sessionId: input.sessionId,
      siteId: input.siteId,
    });
    /**
     * Un vencimiento que no tuvo a dónde ir se guarda IGUAL. El estado que vuelve
     * ya no tiene plazo, y si no se persiste, el barrido encuentra la misma
     * conversación vencida en cada pasada — para siempre, cada minuto.
     */
    if (input.timedOut) {
      await waSvc.patchSession(phone, { graph: plan.state } as never).catch(() => undefined);
    }
    return { handled: false, exclusive };
  }

  /**
   * La traza del recorrido: un evento por nodo, con la versión del grafo y —desde
   * ahora— POR QUÉ ARISTA se llegó.
   *
   * El par de nodos no alcanza cuando dos salidas distintas terminan en el mismo paso
   * ("Sí" y "No" cerrando las dos en el cierre), que es un recorrido de todos los
   * días: sin el id de la arista, la analítica por rama tendría que adivinar cuál se
   * tomó. Es json libre, así que no necesita migración; los eventos viejos no lo
   * traen y la agregación se las arregla igual.
   */
  const aristaPorNodo = new Map(plan.trail.map((hop) => [hop.to, hop.edgeId]));
  for (const nodeId of plan.state.visited.slice(state.visited.length)) {
    const edgeId = aristaPorNodo.get(nodeId);
    trackWaEvent(container, {
      phone,
      type: 'node_entered',
      step: nodeId,
      payload: {
        node_id: nodeId,
        version_id: active.versionId,
        ...(edgeId ? { edge_id: edgeId } : {}),
      },
      usedAi: false,
      sessionId: input.sessionId,
      siteId: input.siteId,
    });
  }

  let sentSomething = false;
  for (const step of plan.steps) {
    const ok = await runStep(input, step, plan.state);
    sentSomething = sentSomething || ok;
  }

  // El estado se persiste IGUAL aunque un envío haya fallado: el cliente pudo haber
  // recibido los primeros mensajes, y volver a arrancar el recorrido desde cero le
  // repetiría todo.
  await waSvc
    .patchSession(phone, { graph: plan.state } as never)
    .catch(() => undefined);

  return { handled: sentSomething, exclusive };
}
