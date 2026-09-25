import type { MedusaContainer } from '@medusajs/framework/types';

import { STORE_CONFIG_MODULE } from '../../modules/store-config';
import {
  botSilenciado,
  readBotSwitch,
  type StoreSettingLister,
  type StoreSettingReader,
  type WhatsappBotSwitch,
} from '../../modules/kapso-whatsapp/bot-switch';

/**
 * ¿Contesta el bot en esta tienda?
 *
 * El seam entre el runtime y el interruptor, con la misma forma que
 * `readConfiguredChannelIds` de `order-context.ts`: `store-config` se resuelve por
 * CLAVE y defensivamente, porque es otra extensión y puede no estar instalada.
 *
 * ── NO USA `readSetting` ─────────────────────────────────────────────────────
 * Usa `botSilenciado`, que mira TODAS las filas que alcanzan al mensaje en vez de la
 * que gana por precedencia. Es la diferencia entre "qué dice la config que aplica
 * acá" —lo que la pantalla muestra— y "¿alguien apagó esto?", que es lo único que le
 * importa a un interruptor de emergencia. Con `readSetting`, un apagado guardado en
 * la fila de una tienda era invisible para un webhook que no recibe `?site=`: la
 * pantalla decía Apagado y el bot contestaba igual.
 *
 * FALLA ABIERTO ante un ERROR, y eso no cambia. Si la base no responde o el módulo no
 * está, el bot contesta: un lector de configuración que falle apagando deja el número
 * mudo por un hipo de Postgres, y el síntoma —nadie recibe respuesta— es
 * indistinguible de un apagado deliberado. Lo que ahora falla CERRADO es otra cosa: un
 * apagado explícito que existe y que un problema de ÁMBITO haría invisible.
 */
export async function readWaBotSwitch(
  container: MedusaContainer,
  siteId: string | null,
): Promise<WhatsappBotSwitch> {
  try {
    const service = container.resolve(STORE_CONFIG_MODULE) as StoreSettingReader & StoreSettingLister;
    // La nota sale de la fila que aplica —es para humanos—; el `enabled` sale de mirar
    // todas, que es la pregunta que importa.
    const base = await readBotSwitch(service, siteId);
    try {
      return { enabled: !(await botSilenciado(service, siteId)), note: base.note };
    } catch {
      /**
       * Si el barrido de ámbitos falla —un `listStoreSettings` que no está, una
       * consulta que revienta— se cae a la PRECEDENCIA, no a "encendido".
       *
       * Es la misma trampa que este archivo viene a cerrar: un `catch` que devuelve
       * `enabled: true` convierte cualquier problema en "el bot contesta", que es
       * exactamente el bug. Degradar al comportamiento anterior respeta igual el
       * apagado guardado en la fila que aplica; lo único que se pierde es ver las
       * otras.
       */
      return base;
    }
  } catch {
    return { enabled: true, note: null };
  }
}
