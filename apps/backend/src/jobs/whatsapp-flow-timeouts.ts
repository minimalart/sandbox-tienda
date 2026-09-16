import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { runFlowTurn } from '../lib/whatsapp/flow/runtime';
import { planTimeoutSweep, sweepCutoff, type SleepingRow } from '../lib/whatsapp/flow/timeouts';
import { WHATSAPP_AGENT_MODULE } from '../modules/whatsapp-agent';
import type WhatsappAgentModuleService from '../modules/whatsapp-agent/service';

/**
 * Despierta las conversaciones que se quedaron esperando una respuesta que no llegó.
 *
 * Es el único momento en el que el bot vuelve a mirar una conversación sin que el
 * cliente escriba. Todo lo demás del bot es reactivo: sin este barrido, un paso con
 * plazo sería un campo que no hace nada.
 *
 * La decisión de a quién despertar vive en `flow/timeouts.ts` y se testea aparte;
 * acá sólo está lo que necesita base y contenedor.
 */
export default async function whatsappFlowTimeouts(container: MedusaContainer) {
  const pg: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  let resuelto: WhatsappAgentModuleService | null = null;
  try {
    resuelto = container.resolve<WhatsappAgentModuleService>(WHATSAPP_AGENT_MODULE);
  } catch {
    return; // El módulo no está activo en esta instalación.
  }
  if (!resuelto) return;
  const waSvc = resuelto;

  /**
   * Las vencidas. El filtro entero va en la consulta y no en memoria: esto corre
   * cada minuto y lo normal es que no haya ninguna, así que la pasada tiene que
   * costar una consulta que no devuelve nada.
   *
   * `status = 'bot'` saca las que está atendiendo una persona: ahí el recorrido no
   * responde, y un "¿seguís ahí?" automático en el medio de una charla con un
   * humano es exactamente lo que no tiene que pasar.
   */
  const rows: Array<{ phone: string; session: any }> = await pg('whatsapp_conversation')
    .whereNull('deleted_at')
    .where('status', 'bot')
    .whereRaw("session -> 'graph' ->> 'awaiting_until' is not null")
    .whereRaw("session -> 'graph' ->> 'awaiting_until' < ?", [sweepCutoff()])
    .select('phone', 'session')
    .orderBy('phone')
    .limit(200);

  if (rows.length === 0) return;

  const versions: Array<{ id: string; site_id: string | null }> = await pg('whatsapp_flow_version')
    .whereNull('deleted_at')
    .where('status', 'active')
    .select('id', 'site_id');

  const sleeping: SleepingRow[] = rows.map((row) => ({
    phone: row.phone,
    graph: (row.session?.graph ?? null) as SleepingRow['graph'],
  }));

  const plan = planTimeoutSweep(
    sleeping,
    versions.map((v) => ({ versionId: v.id, siteId: v.site_id ?? null })),
  );

  for (const phone of plan.stale) {
    await waSvc.patchSession(phone, { graph: null } as never).catch(() => undefined);
  }

  for (const { phone, siteId } of plan.due) {
    try {
      const session = (await waSvc.getSession(phone)) as unknown as { session_id?: string };
      await runFlowTurn({
        container,
        waSvc,
        phone,
        sessionId: session?.session_id ?? null,
        siteId,
        text: null,
        selectionId: null,
        timedOut: true,
      });
    } catch {
      // Una conversación que falla no puede frenar a las demás. Vuelve a entrar en
      // la próxima pasada: el plazo sigue vencido hasta que alguien lo resuelva.
    }
  }
}

export const config = { name: 'whatsapp-flow-timeouts', schedule: '* * * * *' };
