import type { NativeToolContext, NativeToolDef } from './index';
import { NATIVE_TOOL } from './names';

/**
 * Tools nativas de FIDELIZACIÓN y SEGMENTOS para propuestas. Existen porque ni
 * el MCP de Medusa ni el de extensiones cubren estas operaciones:
 * - el módulo de fidelización (`loyalty_engine`) no está expuesto a ninguna tool;
 * - emitir una gift card A UN CLIENTE requiere create + claim (dos workflows del
 *   loyalty-plugin; el MCP solo tiene el create sin customer);
 * - crear un grupo dinámico por el MCP deja el grupo VACÍO (falta el recálculo).
 * NINGUNA está en NATIVE_ANALYSIS_TOOLS: durante el análisis solo se proponen y
 * corren recién al aprobar la propuesta (via executeProposal).
 */

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function intOf(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : [];
}

const LOYALTY_MODULE_KEY = 'loyalty_engine';

function loyaltyService(ctx: NativeToolContext): any | null {
  try {
    return ctx.container.resolve(LOYALTY_MODULE_KEY);
  } catch {
    return null;
  }
}

export const LOYALTY_TOOL_DEFS: NativeToolDef[] = [
  {
    name: NATIVE_TOOL.createLoyaltyCampaign,
    description:
      'Crea una CAMPAÑA DE PUNTOS del programa de fidelización activo (multiplicador con vigencia, p. ej. puntos dobles por una semana). La aprobación humana de la propuesta es el consentimiento: se crea activa dentro de sus fechas.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre de la campaña (p. ej. "Puntos dobles de invierno").' },
        multiplier: { type: 'number', description: 'Multiplicador entero de puntos (2 = puntos dobles).' },
        starts_at: { type: 'string', description: 'Inicio de vigencia (ISO o YYYY-MM-DD).' },
        ends_at: { type: 'string', description: 'Fin de vigencia (ISO o YYYY-MM-DD).' },
        affected_rule_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs de earn rules alcanzadas (vacío = todas).',
        },
      },
      required: ['name', 'multiplier', 'starts_at', 'ends_at'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.createLoyaltyReward,
    description:
      'Crea un REWARD canjeable por puntos en el programa de fidelización activo (descuento fijo/porcentual, envío gratis o crédito en tienda).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        cost_points: { type: 'number', description: 'Costo en puntos (entero ≥ 0).' },
        type: {
          type: 'string',
          enum: ['fixed_discount', 'percent_discount', 'free_shipping', 'store_credit'],
        },
        value: {
          type: 'number',
          description: 'Valor del beneficio: monto (fixed_discount/store_credit) o porcentaje (percent_discount). No aplica a free_shipping.',
        },
        currency_code: { type: 'string', description: 'Moneda para montos fijos (default "ars").' },
        stock: { type: 'number', description: 'Cupo de canjes (opcional).' },
        valid_from: { type: 'string' },
        valid_to: { type: 'string' },
      },
      required: ['name', 'cost_points', 'type'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.issueGiftCard,
    description:
      'Emite una GIFT CARD y la asigna a un cliente específico (create + claim del plugin oficial). Para win-back o compensación de clientes VIP. El cliente la ve en su cuenta.',
    parameters: {
      type: 'object',
      properties: {
        value: { type: 'number', description: 'Valor de la gift card (en la moneda indicada).' },
        currency_code: { type: 'string', description: 'Moneda, p. ej. "ars".' },
        customer_id: { type: 'string', description: 'Cliente al que se le asigna (cus_...).' },
        expires_at: { type: 'string', description: 'Vencimiento ISO (opcional).' },
        note: { type: 'string', description: 'Motivo interno (queda en metadata).' },
      },
      required: ['value', 'currency_code', 'customer_id'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.createDynamicGroup,
    description:
      'Crea un GRUPO DINÁMICO de clientes (segmento automático por comportamiento) Y lo puebla en el momento (recálculo inicial). Devuelve el customer_group_id (usable en otra acción de la misma propuesta via "$prev.customer_group_id" para una promo dirigida). Campos de condición: orders_count, total_spend, spend_last_days, orders_last_days, days_since_last_order, aov, province, country, is_wholesale, registered_no_purchase, account_age_days, birthday_this_month.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre del grupo (min 2 chars).' },
        description: { type: 'string' },
        match: { type: 'string', enum: ['all', 'any'], description: 'all = todas las condiciones (AND); any = alguna (OR).' },
        conditions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              operator: { type: 'string', enum: ['gte', 'lte', 'eq', 'neq', 'in', 'contains'] },
              value: {},
              days: { type: 'number', description: 'Ventana en días para campos *_last_days.' },
            },
            required: ['field', 'operator'],
            additionalProperties: false,
          },
        },
        update_mode: { type: 'string', enum: ['realtime', 'manual'], description: 'Default realtime (se mantiene solo).' },
      },
      required: ['name', 'conditions'],
      additionalProperties: false,
    },
  },
];

async function runCreateLoyaltyCampaign(
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  const svc = loyaltyService(ctx);
  if (!svc) return 'Error: el módulo de fidelización no está instalado en esta tienda.';
  // `null` = el programa GLOBAL. El asistente corre a nivel instalación —su `ai_config`
  // es una fila única y `NativeToolContext` no lleva tienda—, así que no hay eje que
  // pasar; inventarlo haría que la campaña naciera colgada del programa de una tienda
  // que el operador no eligió.
  const program = await svc.getActiveProgram(null);
  if (!program) return 'Error: no hay un programa de fidelización ACTIVO; creá/activá uno primero en Fidelización.';
  const name = str(args.name);
  const multiplier = intOf(args.multiplier);
  const startsAt = str(args.starts_at);
  const endsAt = str(args.ends_at);
  if (!name) return 'Error: falta `name`.';
  if (!multiplier || multiplier < 2) return 'Error: `multiplier` debe ser un entero ≥ 2.';
  if (!startsAt || !endsAt) return 'Error: faltan `starts_at`/`ends_at`.';
  const created = await svc.createCampaigns({
    program_id: program.id,
    name,
    status: 'active',
    multiplier,
    starts_at: new Date(startsAt),
    ends_at: new Date(endsAt),
    affected_rule_ids: strArr(args.affected_rule_ids),
  });
  const row = Array.isArray(created) ? created[0] : created;
  return `OK: campaña de puntos creada (x${multiplier}, ${startsAt} → ${endsAt}). campaign_id=${row?.id}. Se administra en Fidelización → Campañas.`;
}

async function runCreateLoyaltyReward(
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  const svc = loyaltyService(ctx);
  if (!svc) return 'Error: el módulo de fidelización no está instalado en esta tienda.';
  // `null` = el programa GLOBAL; misma razón que en la campaña de arriba.
  const program = await svc.getActiveProgram(null);
  if (!program) return 'Error: no hay un programa de fidelización ACTIVO; creá/activá uno primero en Fidelización.';
  const name = str(args.name);
  const costPoints = intOf(args.cost_points);
  const type = str(args.type);
  if (!name) return 'Error: falta `name`.';
  if (costPoints === undefined || costPoints < 0) return 'Error: `cost_points` debe ser un entero ≥ 0.';
  if (!type || !['fixed_discount', 'percent_discount', 'free_shipping', 'store_credit'].includes(type)) {
    return 'Error: `type` inválido.';
  }
  const value = Number(args.value);
  if (type !== 'free_shipping' && (!Number.isFinite(value) || value <= 0)) {
    return 'Error: falta `value` (> 0) para este tipo de reward.';
  }
  const config: Record<string, unknown> = {};
  if (type !== 'free_shipping') config.value = value;
  if (type === 'fixed_discount' || type === 'store_credit') {
    config.currency_code = str(args.currency_code) ?? 'ars';
  }
  const created = await svc.createRewards({
    program_id: program.id,
    name,
    description: str(args.description) ?? null,
    cost_points: costPoints,
    type,
    config,
    stock: intOf(args.stock) ?? null,
    valid_from: str(args.valid_from) ? new Date(str(args.valid_from)!) : null,
    valid_to: str(args.valid_to) ? new Date(str(args.valid_to)!) : null,
    status: 'active',
  });
  const row = Array.isArray(created) ? created[0] : created;
  return `OK: reward creado (${type}, ${costPoints} puntos). reward_id=${row?.id}. Se administra en Fidelización → Rewards.`;
}

async function runIssueGiftCard(
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  const value = Number(args.value);
  const currency = str(args.currency_code);
  const customerId = str(args.customer_id);
  if (!Number.isFinite(value) || value <= 0) return 'Error: `value` debe ser > 0.';
  if (!currency) return 'Error: falta `currency_code`.';
  if (!customerId) return 'Error: falta `customer_id`.';

  let workflows: any;
  try {
    workflows = await import('@medusajs/loyalty-plugin/workflows');
  } catch {
    return 'Error: el plugin de gift cards no está instalado en esta tienda.';
  }
  // create: el plugin genera un código criptográfico si se omite `code`.
  const { result } = await workflows.createGiftCardsWorkflow(ctx.container).run({
    input: [
      {
        value,
        currency_code: currency,
        expires_at: str(args.expires_at) ?? null,
        customer_id: null,
        metadata: { source: 'ai_proposal', note: str(args.note) ?? null },
      },
    ] as any,
  });
  const created = Array.isArray(result) ? result[0] : result;
  if (!created?.code) return 'Error: la gift card no se pudo emitir.';
  // claim: la asigna al cliente (aparece en su cuenta).
  await workflows.claimGiftCardWorkflow(ctx.container).run({
    input: { code: created.code, customer_id: customerId },
  });
  return `OK: gift card emitida y asignada al cliente ${customerId}. gift_card_id=${created.id} | valor=${value} ${currency}. (El código no se muestra por seguridad; el cliente la ve en su cuenta.)`;
}

async function runCreateDynamicGroup(
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  const name = str(args.name);
  if (!name || name.length < 2) return 'Error: falta `name` (min 2 chars).';
  const conditions = Array.isArray(args.conditions) ? (args.conditions as any[]) : [];
  if (!conditions.length) return 'Error: faltan `conditions` (al menos una).';

  let createWf: any;
  let recalcWf: any;
  try {
    // Import dinámico + string dinámico para no acoplar el módulo ai-assistant al build de
    // los workflows. Los workflows viven en @minimalart/mercatto-plugin-dynamic-groups;
    // el catch de abajo hace no-op si el plugin no está instalado.
    const createSpecifier =
      '@minimalart/mercatto-plugin-dynamic-groups/workflows/create-dynamic-group';
    const recalcSpecifier =
      '@minimalart/mercatto-plugin-dynamic-groups/workflows/recalculate-dynamic-group';
    ({ createDynamicGroupWorkflow: createWf } = await import(/* @vite-ignore */ createSpecifier));
    ({ recalculateDynamicGroupWorkflow: recalcWf } = await import(/* @vite-ignore */ recalcSpecifier));
  } catch {
    return 'Error: la extensión de grupos dinámicos no está instalada en esta tienda.';
  }
  const { result: group } = await createWf(ctx.container).run({
    input: {
      name,
      description: str(args.description) ?? null,
      match: args.match === 'any' ? 'any' : 'all',
      conditions,
      update_mode: args.update_mode === 'manual' ? 'manual' : 'realtime',
      is_active: true,
    },
  });
  const groupId = (group as { id?: string })?.id;
  const customerGroupId = (group as { customer_group_id?: string })?.customer_group_id;
  if (!groupId) return 'Error: el grupo dinámico no se pudo crear.';

  // Recálculo inicial: sin esto el grupo queda VACÍO hasta el próximo evento.
  let members = 0;
  try {
    const { result: stats } = await recalcWf(ctx.container).run({ input: { id: groupId } });
    members = Number((stats as { members?: number })?.members ?? 0);
  } catch {
    return `OK (parcial): grupo dinámico creado pero el recálculo inicial falló; recalculalo desde el admin. dynamic_group_id=${groupId} | customer_group_id=${customerGroupId}`;
  }
  return `OK: grupo dinámico creado y poblado (${members} cliente(s)). dynamic_group_id=${groupId} | customer_group_id=${customerGroupId}. Se administra en Grupos dinámicos.`;
}

/** Ejecuta una tool de fidelización/segmentos por nombre; `undefined` si no es de este set. */
export async function runLoyaltyNativeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string | undefined> {
  if (name === NATIVE_TOOL.createLoyaltyCampaign) return runCreateLoyaltyCampaign(args, ctx);
  if (name === NATIVE_TOOL.createLoyaltyReward) return runCreateLoyaltyReward(args, ctx);
  if (name === NATIVE_TOOL.issueGiftCard) return runIssueGiftCard(args, ctx);
  if (name === NATIVE_TOOL.createDynamicGroup) return runCreateDynamicGroup(args, ctx);
  return undefined;
}
