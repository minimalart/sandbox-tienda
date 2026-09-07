import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../modules/ai-assistant';
import { saveMemory, type MemoryStore, type MemoryType } from '../../../../modules/ai-assistant/ai/memory';
import type { AdminCreateMemoryType } from '../validators';

type AiService = any;
const TENANT = 'default';

const SELECT_COLUMNS = [
  'id',
  'tenant_id',
  'agent_key',
  'memory_type',
  'entity_type',
  'entity_id',
  'title',
  'content',
  'summary',
  'metadata',
  'tags',
  'source',
  'source_ref_id',
  'importance_score',
  'confidence_score',
  'status',
  'embedding_model',
  'embedded_at',
  'created_by',
  'last_used_at',
  'usage_count',
  'created_at',
  'updated_at',
];

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** GET /admin/ai-assistant/memory — lista con filtros + búsqueda por texto. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const knex: any = (service as any).__container__.manager.getKnex();
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const base = () => {
    let qb = knex('ai_agent_memory').whereNull('deleted_at').where('tenant_id', TENANT);
    const status = str(req.query.status);
    if (status) qb = qb.where('status', status);
    const agentKey = str(req.query.agent_key);
    if (agentKey === 'null') qb = qb.whereNull('agent_key');
    else if (agentKey) qb = qb.where('agent_key', agentKey);
    const memoryType = str(req.query.memory_type);
    if (memoryType) qb = qb.where('memory_type', memoryType);
    const entityType = str(req.query.entity_type);
    if (entityType) qb = qb.where('entity_type', entityType);
    const entityId = str(req.query.entity_id);
    if (entityId) qb = qb.where('entity_id', entityId);
    const from = str(req.query.from);
    if (from) qb = qb.where('created_at', '>=', from);
    const to = str(req.query.to);
    if (to) qb = qb.where('created_at', '<=', to);
    const q = str(req.query.q);
    if (q) {
      const like = `%${q}%`;
      qb = qb.where((b: any) => {
        b.where('title', 'ilike', like).orWhere('content', 'ilike', like);
      });
    }
    const tag = str(req.query.tag);
    if (tag) qb = qb.whereRaw('tags @> ?::jsonb', [JSON.stringify([tag])]);
    return qb;
  };

  try {
    const rows = await base().select(SELECT_COLUMNS).orderBy('created_at', 'desc').limit(limit).offset(offset);
    const [{ count }] = await base().count('* as count');
    res.json({ memories: rows, count: Number(count) });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
};

/** POST /admin/ai-assistant/memory — crea una memoria manual (activa). */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminCreateMemoryType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const body = req.validatedBody;
  const createdBy = req.auth_context?.actor_id ?? 'unknown';
  const row = await saveMemory(service as MemoryStore, {
    tenantId: TENANT,
    agentKey: body.agent_key ?? null,
    memoryType: body.memory_type as MemoryType,
    title: body.title,
    content: body.content,
    summary: body.summary ?? null,
    entityType: body.entity_type ?? null,
    entityId: body.entity_id ?? null,
    tags: body.tags ?? null,
    source: 'manual',
    importanceScore: body.importance_score,
    confidenceScore: body.confidence_score,
    status: 'active',
    createdBy,
  });
  if (!row) {
    res.status(500).json({ message: 'No se pudo crear la memoria.' });
    return;
  }
  res.status(201).json({ memory: row });
};
