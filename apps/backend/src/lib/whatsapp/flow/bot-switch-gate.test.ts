import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { MedusaContainer } from '@medusajs/framework/types';

import { STORE_CONFIG_MODULE } from '../../../modules/store-config';
import { invalidateActiveFlows } from '../../../modules/whatsapp-flow/cache';
import { WHATSAPP_FLOW_MODULE } from '../../../modules/whatsapp-flow/types';
import { runFlowTurn } from './runtime';

/**
 * CON EL BOT APAGADO, EL RECORRIDO NO HABLA — venga de donde venga el turno.
 *
 * El interruptor nació gateando el webhook, y eso dejó afuera al OTRO caller: el
 * barrido de plazos vencidos (`jobs/whatsapp-flow-timeouts.ts`), que corre cada
 * minuto y manda mensajes sin que nadie escriba. El bot apagado seguía despertando
 * conversaciones, que es exactamente el síntoma que el interruptor viene a evitar —
 * y el peor de todos, porque el operador ya cree que lo apagó.
 *
 * Por eso el gate se mudó adentro de `runFlowTurn`, que es por donde pasan los dos.
 * Este test afirma que sigue ahí y que corta ANTES de tocar nada: si alguien lo
 * mueve de vuelta a los callers, vuelve el agujero y acá se ve.
 */

type Stub = { pedidos: string[]; container: MedusaContainer };

/**
 * Un contenedor con store-config Y un recorrido publicado DE VERDAD.
 *
 * El grafo activo tiene que resolver bien, y no es un detalle: la primera versión de
 * este test dejaba que el contenedor tirara al pedir el módulo de recorridos, y
 * `cache.ts` se traga esa excepción y devuelve `null`. Resultado: el test pasaba
 * IGUAL sin el gate, porque el recorrido no corría por otro motivo. Verde por la
 * razón equivocada — sacar el gate tenía que ponerlo en rojo y no lo ponía.
 *
 * Con un grafo que sí atiende, lo único que puede evitar que el recorrido hable es
 * el interruptor.
 */
function contenedor(enabled: boolean, opts: { sinLista?: boolean } = {}): Stub {
  const pedidos: string[] = [];
  const container = {
    resolve: (key: string) => {
      pedidos.push(key);
      if (key === STORE_CONFIG_MODULE) {
        // Las DOS entradas, como el service de verdad: `readSetting` para la
        // precedencia (lo que muestra la pantalla) y `listStoreSettings` para el
        // barrido de ámbitos (lo que decide si el bot habla).
        const readSetting = async () => ({ value: { enabled, note: null } });
        // `sinLista` simula un store-config viejo: sirve para afirmar que el lector
        // degrada a la precedencia en vez de caer en "encendido".
        return opts.sinLista
          ? { readSetting }
          : {
              readSetting,
              listStoreSettings: async () => [{ site_id: null, value: { enabled, note: null } }],
            };
      }
      if (key === WHATSAPP_FLOW_MODULE) {
        return {
          getActiveVersion: async () => ({
            id: 'waflw_activa',
            graph: {
              nodes: [
                { id: 'inicio', type: 'start', match: { fallback: true }, next: 'saludo' },
                { id: 'saludo', type: 'message', body: 'Hola' },
              ],
              edges: [{ id: 'e1', from: 'inicio', to: 'saludo' }],
            },
            metadata: null,
          }),
        };
      }
      throw new Error(`unexpected resolve(${key})`);
    },
  } as unknown as MedusaContainer;
  return { pedidos, container };
}

/** La sesión NO se toca cuando el bot está apagado: el plazo queda vencido. */
function waSvcQueSeQueja() {
  const llamadas: string[] = [];
  return {
    llamadas,
    svc: {
      getSession: async () => { llamadas.push('getSession'); return { session_id: 's1' }; },
      patchSession: async () => { llamadas.push('patchSession'); },
    } as never,
  };
}

/**
 * La caché del grafo activo es de MÓDULO y dura 30 s: sin esto, un caso le deja el
 * grafo cargado al siguiente y dejan de ser independientes. Vive a nivel de archivo
 * porque la usan los dos `describe`.
 */
const limpio = () => invalidateActiveFlows();

describe('el interruptor del bot corta el recorrido', () => {
  it('apagado: no atiende, y no toca la sesión', async () => {
    limpio();
    const { container } = contenedor(false);
    const { svc, llamadas } = waSvcQueSeQueja();

    const out = await runFlowTurn({
      container,
      waSvc: svc,
      phone: '5491111111111',
      sessionId: 's1',
      siteId: null,
      text: 'hola',
      selectionId: null,
    });

    assert.deepEqual(out, { handled: false, exclusive: false });
    // Ni leerla: salir antes es lo que deja el plazo vencido intacto, así que apagar
    // PAUSA el recorrido en vez de consumirle el vencimiento en silencio.
    assert.deepEqual(llamadas, []);
  });

  it('apagado: tampoco atiende un vencimiento del barrido', async () => {
    // Es el caso que se escapó: nadie escribió, lo despierta el cron.
    limpio();
    const { container } = contenedor(false);
    const { svc, llamadas } = waSvcQueSeQueja();

    const out = await runFlowTurn({
      container,
      waSvc: svc,
      phone: '5491111111111',
      sessionId: 's1',
      siteId: null,
      text: null,
      selectionId: null,
      timedOut: true,
    });

    assert.equal(out.handled, false);
    assert.deepEqual(llamadas, []);
  });

  it('el caller que ya preguntó no vuelve a preguntar', async () => {
    // El webhook gatea antes del handoff; sin esto pagaría la consulta dos veces por
    // mensaje. `botEnabled: false` tiene que cortar igual, sin resolver store-config.
    limpio();
    const { container, pedidos } = contenedor(true);
    const { svc, llamadas } = waSvcQueSeQueja();

    const out = await runFlowTurn({
      container,
      waSvc: svc,
      phone: '5491111111111',
      sessionId: 's1',
      siteId: null,
      text: 'hola',
      selectionId: null,
      botEnabled: false,
    });

    assert.equal(out.handled, false);
    assert.deepEqual(llamadas, []);
    assert.deepEqual(pedidos, [], 'no tendría que haber resuelto store-config');
  });
});

/**
 * El seam degrada a la PRECEDENCIA, no a "encendido".
 *
 * Salió del rebase sobre el gate de los timeouts: al pasar el runtime a mirar todos
 * los ámbitos, un store-config sin `listStoreSettings` caía en el `catch` ancho y
 * devolvía `enabled: true` — el mismo bug que el cambio venía a cerrar, entrando por
 * otra puerta. Lo destapó un test que ya existía, no uno nuevo.
 */
describe('el lector del interruptor degrada sin fallar abierto', () => {
  it('sin listStoreSettings, sigue respetando la fila que aplica', async () => {
    limpio();
    // MISMO contenedor que el resto: con un recorrido publicado que SÍ atendería.
    // Sin eso el caso pasaba por el motivo equivocado —el grafo no resolvía— y el
    // señuelo que devolvía `enabled: true` no lo ponía en rojo.
    const { container } = contenedor(false, { sinLista: true });
    const { svc, llamadas } = waSvcQueSeQueja();

    const out = await runFlowTurn({
      container,
      waSvc: svc,
      phone: '5491111111111',
      sessionId: 's1',
      siteId: null,
      text: 'hola',
      selectionId: null,
    });

    assert.equal(out.handled, false);
    assert.deepEqual(llamadas, []);
  });
});
