import type { MedusaContainer } from '@medusajs/framework/types';

import type { FlowGraph } from '../../lib/whatsapp/flow/graph';
import { EMPTY_GRAPH } from '../../lib/whatsapp/flow/graph';
import { WHATSAPP_FLOW_MODULE, DEFAULT_FLOW_KEY } from './types';
import type { FlowVersionRow } from './service';

/**
 * Caché en proceso del grafo activo.
 *
 * El bot lo lee en CADA mensaje entrante; sin caché serían dos consultas por turno
 * para una fila que cambia cuando alguien aprieta publicar. Se guarda la PROMESA y
 * no el valor para que una ráfaga de mensajes no dispare N consultas iguales
 * (mismo criterio que `recommendations/serve/cache.ts`).
 *
 * El TTL es corto igualmente porque `publishFlowVersion` invalida a mano: el TTL es
 * la red por si el swap corre en otro proceso —en `MEDUSA_WORKER_MODE` hay dos—.
 */

const TTL_MS = 30_000;

export type ActiveFlow = {
  versionId: string;
  graph: FlowGraph;
  /**
   * `true` = este recorrido atiende TODO: si algo no sale por el grafo, no se cae
   * al router viejo ni al modelo.
   *
   * Vive en la versión del grafo y no en un ajuste de la instalación a propósito.
   * Apagar el LLM es una propiedad del RECORRIDO —de si está lo bastante completo
   * como para bastarse solo—, así que se publica y se despublica con él: volver
   * atrás es publicar la versión anterior, sin tocar configuración ni deployar. Y
   * evita el modo de falla de los ajustes de WhatsApp, que se pueden guardar en el
   * scope de una tienda que después nadie lee.
   */
  exclusive: boolean;
} | null;

type Entry = { value: Promise<ActiveFlow>; expires: number };

const entries = new Map<string, Entry>();

const cacheKey = (flowKey: string, siteId: string | null): string => `${flowKey}|${siteId ?? ''}`;

/** Lo llama `publishFlowVersion`. Sin esto el bot atiende con el grafo anterior. */
export function invalidateActiveFlows(): void {
  entries.clear();
}

/** Convierte el json de la fila en un grafo usable. Nunca lanza. */
function toGraph(raw: unknown): FlowGraph {
  if (!raw || typeof raw !== 'object') return EMPTY_GRAPH;
  const candidate = raw as Partial<FlowGraph>;
  return {
    nodes: Array.isArray(candidate.nodes) ? candidate.nodes : [],
    edges: Array.isArray(candidate.edges) ? candidate.edges : [],
  };
}

async function read(
  container: MedusaContainer,
  flowKey: string,
  siteId: string | null,
): Promise<ActiveFlow> {
  try {
    const service = container.resolve(WHATSAPP_FLOW_MODULE) as {
      getActiveVersion: (k: string, s: string | null) => Promise<FlowVersionRow | null>;
    };
    const row = await service.getActiveVersion(flowKey, siteId);
    if (!row) return null;
    const graph = toGraph(row.graph);
    // Un grafo publicado pero vacío no es "activo": mejor que el caller caiga a su
    // fallback a que el motor devuelva `no_match` en cada mensaje.
    if (graph.nodes.length === 0) return null;
    const metadata = (row as { metadata?: unknown }).metadata;
    const exclusive =
      metadata !== null &&
      typeof metadata === 'object' &&
      (metadata as Record<string, unknown>).exclusive === true;
    return { versionId: row.id, graph, exclusive };
  } catch {
    // El módulo puede no estar registrado (instalación sin la extensión). El bot
    // sigue funcionando con el camino viejo.
    return null;
  }
}

export function getActiveFlow(
  container: MedusaContainer,
  flowKey: string = DEFAULT_FLOW_KEY,
  siteId: string | null = null,
): Promise<ActiveFlow> {
  const key = cacheKey(flowKey, siteId);
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && hit.expires > now) return hit.value;

  const value = read(container, flowKey, siteId);
  entries.set(key, { value, expires: now + TTL_MS });
  // Una lectura fallida no se cachea: sería dejar al bot sin grafo 30 s por un
  // hipo de la base.
  void value.then((v) => {
    if (v === null) entries.delete(key);
  });
  return value;
}
