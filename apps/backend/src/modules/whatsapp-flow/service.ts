import { MedusaService } from '@medusajs/framework/utils';

import { chooseDraftTarget } from './choose-draft';
import { WhatsappFlowVersion } from './models';
import { DEFAULT_FLOW_KEY, type FlowVersionStatus } from './types';

export type FlowVersionRow = {
  id: string;
  flow_key: string;
  site_id: string | null;
  status: FlowVersionStatus;
  version: number;
  name: string | null;
  graph: unknown;
  notes: string | null;
  published_at: Date | null;
  published_by: string | null;
  created_at: Date;
  updated_at: Date;
};

/** `null` (instancia) y `''` tienen que comparar igual, como en el índice único. */
const siteKey = (siteId: string | null | undefined): string => siteId ?? '';

class WhatsappFlowModuleService extends MedusaService({ WhatsappFlowVersion }) {
  /**
   * La versión que está sirviendo. `null` = el flujo todavía no se publicó, y el
   * caller cae a su fallback en vez de dejar al cliente sin respuesta.
   */
  async getActiveVersion(
    flowKey: string = DEFAULT_FLOW_KEY,
    siteId: string | null = null,
  ): Promise<FlowVersionRow | null> {
    const rows = (await this.listWhatsappFlowVersions(
      { flow_key: flowKey, status: 'active' },
      { take: 50 },
    )) as unknown as FlowVersionRow[];

    // La de la TIENDA gana sobre la de la instancia, igual que `activeVersionFor`
    // del motor de recomendaciones.
    return (
      rows.find((r) => siteKey(r.site_id) === siteKey(siteId)) ??
      rows.find((r) => siteKey(r.site_id) === '') ??
      null
    );
  }

  /**
   * TODOS los borradores de esta tienda, del más nuevo al más viejo.
   *
   * Son varios desde que el editor pasó a ser un ABM: se arman dos o tres recorridos
   * y se elige cuál se publica. Lo que sigue habiendo de a uno es el PUBLICADO —
   * `UQ_whatsapp_flow_version_active` lo garantiza en la base.
   */
  async listDrafts(
    flowKey: string = DEFAULT_FLOW_KEY,
    siteId: string | null = null,
  ): Promise<FlowVersionRow[]> {
    const rows = (await this.listWhatsappFlowVersions(
      { flow_key: flowKey, status: 'draft' },
      { take: 200, order: { updated_at: 'DESC' } },
    )) as unknown as FlowVersionRow[];
    return rows.filter((r) => siteKey(r.site_id) === siteKey(siteId));
  }

  /**
   * Un borrador cualquiera de esta tienda. Queda para los callers que preguntan
   * "¿hay alguno?"; el que quiere UNO concreto lo pide por id.
   */
  async getDraft(
    flowKey: string = DEFAULT_FLOW_KEY,
    siteId: string | null = null,
  ): Promise<FlowVersionRow | null> {
    return (await this.listDrafts(flowKey, siteId))[0] ?? null;
  }

  /**
   * Guarda un borrador.
   *
   * Con `versionId` pisa ESE y con ninguno crea uno nuevo. Antes elegía solo —pisaba
   * el único borrador que podía existir—, y ahora que puede haber varios, elegir solo
   * sería elegir mal: guardar un recorrido encima de otro es exactamente la pérdida
   * de trabajo que el ABM viene a evitar.
   *
   * El número de versión se calcula acá y no al publicar, así el operador ve desde
   * el editor qué número va a quedar. Es `max + 1` sobre TODO el flujo, incluidas
   * las supersedidas: reusar un número de una versión vieja haría que la traza de
   * una conversación apunte a dos grafos distintos.
   */
  async saveDraft(input: {
    versionId?: string | null;
    flowKey?: string;
    siteId?: string | null;
    graph: unknown;
    name?: string | null;
    notes?: string | null;
  }): Promise<FlowVersionRow> {
    const flowKey = input.flowKey ?? DEFAULT_FLOW_KEY;
    const siteId = input.siteId ?? null;

    const pedido = input.versionId
      ? ((await this.retrieveWhatsappFlowVersion(input.versionId).catch(
          () => null,
        )) as unknown as FlowVersionRow | null)
      : null;
    /**
     * La decisión vive en `choose-draft.ts`, con test: es una línea, pero es la que
     * puede pisar el trabajo de otro o el grafo de una versión que ya atendió
     * clientes. Crear de más no cuesta nada; pisar de más no se deshace.
     */
    const existing = chooseDraftTarget(pedido, siteId) === 'update' ? (pedido as FlowVersionRow) : null;
    if (existing) {
      // `as any` como en el resto de los servicios del repo: los tipos que genera
      // `MedusaService` para create/update no aceptan un array parcial.
      const updated: any = await this.updateWhatsappFlowVersions([
        {
          id: existing.id,
          graph: input.graph,
          name: input.name ?? existing.name,
          notes: input.notes ?? existing.notes,
        },
      ] as any);
      return (Array.isArray(updated) ? updated[0] : updated) as FlowVersionRow;
    }

    const all = (await this.listWhatsappFlowVersions(
      { flow_key: flowKey },
      { take: 1000 },
    )) as unknown as FlowVersionRow[];
    const mine = all.filter((r) => siteKey(r.site_id) === siteKey(siteId));
    const nextVersion = mine.reduce((max, r) => Math.max(max, r.version ?? 0), 0) + 1;

    const created: any = await this.createWhatsappFlowVersions([
      {
        flow_key: flowKey,
        site_id: siteId,
        status: 'draft',
        version: nextVersion,
        graph: input.graph,
        name: input.name ?? null,
        notes: input.notes ?? null,
      },
    ] as any);
    return (Array.isArray(created) ? created[0] : created) as FlowVersionRow;
  }
}

export default WhatsappFlowModuleService;
