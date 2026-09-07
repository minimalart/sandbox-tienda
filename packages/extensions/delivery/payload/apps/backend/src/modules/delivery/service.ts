import {
  MedusaService,
  MedusaError,
} from '@medusajs/framework/utils';
import {
  DeliveryExecution,
  TrackingEvent,
  Driver,
  Vehicle,
  ProofOfDelivery,
  DeliveryZone,
  DeliveryRule,
  Route,
  RouteStop,
  DriverShift,
  ZoneResource,
} from './models';
import {
  DELIVERY_TERMINAL_STATUSES,
  isTerminalDeliveryStatus,
  isValidDeliveryTransition,
  isValidProofType,
  requiresProofOfDelivery,
  DEFAULT_ASSIGN_STRATEGY,
  type DeliveryExecutionStatus,
  type ProofType,
  type DeliveryDecision,
  type DeliveryProviderType,
  type DeliveryServiceMode,
  type MaterializedDeliveryRule,
  type RouteStrategy,
  type RuleEvaluationContext,
  type AssignStrategy,
} from './types';
import { isValidAssignStrategy } from './assignment-strategies';
import { evaluateRules } from './rules-engine';
import type { ExecutionOrderAggregate } from './order-query';
import {
  selectEligible,
  type DriverCandidate,
  type EligibilityResult,
  type FleetRequirement,
  type VehicleCandidate,
} from './fleet-eligibility';
import {
  computeDeliveryMetrics,
  type DeliveryMetrics,
  type DeliveryMetricsFilters,
} from './analytics';
import type {
  AppendTrackingEventInput,
} from './tracking-types';

/** Resultado de `retrieveDeliveryExecution` / `updateDeliveryExecutions`. */
type DeliveryExecutionRecord = {
  id: string;
  status: string;
  attempt_count: number;
  [key: string]: unknown;
};

/** Registro de TrackingEvent tal como lo devuelve el factory CRUD. */
type TrackingEventRecord = {
  id: string;
  delivery_execution_id: string;
  source: string;
  code: string;
  occurred_at: Date;
  [key: string]: unknown;
};

/** Registro de ProofOfDelivery tal como lo devuelve el factory CRUD. */
type ProofOfDeliveryRecord = {
  id: string;
  delivery_execution_id: string;
  type: string;
  captured_at: Date;
  [key: string]: unknown;
};

/** Input de captura de un ProofOfDelivery (service.addProofOfDelivery). */
export interface AddProofOfDeliveryInput {
  delivery_execution_id: string;
  type: ProofType | string;
  file_url?: string | null;
  signature_url?: string | null;
  captured_lat?: number | null;
  captured_lng?: number | null;
  captured_by?: string | null;
  pin_validated?: boolean | null;
  note?: string | null;
  /** Default: now. */
  captured_at?: Date | string;
  metadata?: Record<string, unknown> | null;
}

/** Registro de DeliveryZone tal como lo devuelve el factory CRUD. */
type DeliveryZoneRecord = {
  id: string;
  store_location_id: string | null;
  branch_coverage_id: string | null;
  pricing_tier: string | null;
  enabled_providers: string[] | null;
  priority: number;
  active: boolean;
  [key: string]: unknown;
};

/** Registro de DeliveryRule tal como lo devuelve el factory CRUD. */
type DeliveryRuleRecord = {
  id: string;
  name: string;
  delivery_zone_id: string | null;
  priority: number;
  conditions: unknown;
  action: unknown;
  active: boolean;
  [key: string]: unknown;
};

/**
 * Entrada de `resolveDeliveryDecision`. El contexto de evaluación (peso, total,
 * skus, etc.) lo deriva el caller de la orden. La RESOLUCIÓN GEOMÉTRICA
 * (punto→coverage) la hace el caller (workflow) con el service de store-location
 * — el módulo delivery NO reimplementa point-in-polygon ni cruza tablas de
 * store-location; recibe el `branch_coverage_id` ya resuelto y lo mapea a su
 * propia DeliveryZone.
 */
export interface ResolveDeliveryDecisionOpts {
  /** Coverage ya resuelto por store-location.resolveByPoint (preferido). */
  branch_coverage_id?: string | null;
  /** Sucursal resuelta; usado como fallback para encontrar la zona. */
  store_location_id?: string | null;
  /** Zona ya conocida (cortocircuita la resolución por geometría). */
  zone_id?: string | null;
}

class DeliveryModuleService extends MedusaService({
  DeliveryExecution,
  TrackingEvent,
  Driver,
  Vehicle,
  ProofOfDelivery,
  DeliveryZone,
  DeliveryRule,
  Route,
  RouteStop,
  DriverShift,
  ZoneResource,
}) {
  /**
   * Aplica una transición de estado operativo validada contra la state machine
   * (`DELIVERY_TRANSITIONS`).
   *
   * Efectos:
   *  - Valida que `from → to` sea legal; si no, lanza NOT_ALLOWED.
   *  - Si ya está en `toStatus`, es idempotente (devuelve el registro sin tocar).
   *  - Sella el timestamp operativo correspondiente (assigned_at / dispatched_at
   *    / delivered_at / failed_at) y `last_event_at`.
   *  - Incrementa `attempt_count` en `failed_attempt`.
   *
   * NO proyecta todavía a los workflows core de Medusa — ver el TODO más abajo.
   */
  async transition(
    executionId: string,
    toStatus: DeliveryExecutionStatus | string,
    opts?: { event?: unknown },
  ): Promise<DeliveryExecutionRecord> {
    const current = (await this.retrieveDeliveryExecution(
      executionId,
    )) as DeliveryExecutionRecord;

    const from = current.status;
    const to = toStatus as string;

    // Idempotencia: ya está en el estado destino → no-op.
    if (from === to) {
      return current;
    }

    if (isTerminalDeliveryStatus(from)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `DeliveryExecution ${executionId} ya está en estado terminal '${from}'; no admite transición a '${to}'.`,
      );
    }

    if (!isValidDeliveryTransition(from, to)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Transición inválida de DeliveryExecution ${executionId}: '${from}' → '${to}'.`,
      );
    }

    // GATING DE POD (M5): para flota propia, 'delivered' EXIGE al menos un
    // ProofOfDelivery capturado para esta ejecución. Se gatea acá (no en el
    // workflow) para que CUALQUIER vía que intente entregar — driver, admin,
    // script — quede protegida.
    //
    // Solo aplica a provider_type='own_fleet' (ver requiresProofOfDelivery /
    // POD_REQUIRED_PROVIDER_TYPES en types.ts): Andreani lo confirma el carrier
    // sin POD posible y store_pickup se valida por PIN (que se registra como POD
    // 'pin' en su propio flujo). Exigir POD a esos rompería sus flujos.
    if (to === 'delivered' && requiresProofOfDelivery(current.provider_type as string)) {
      const hasPod = await this.hasProofOfDelivery(executionId);
      if (!hasPod) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `No se puede marcar 'delivered' la DeliveryExecution ${executionId} (flota propia) sin una evidencia de entrega (foto, firma o geo). Capturá un ProofOfDelivery antes de confirmar.`,
        );
      }
    }

    const now = new Date();
    const update: Record<string, unknown> = {
      id: executionId,
      status: to,
      last_event_at: now,
    };

    switch (to) {
      case 'assigned':
        update.assigned_at = now;
        break;
      case 'picked_up':
        // Salida física del depósito / retiro por el repartidor.
        update.dispatched_at = now;
        break;
      case 'delivered':
        update.delivered_at = now;
        break;
      case 'failed_attempt':
        update.failed_at = now;
        update.attempt_count = (Number(current.attempt_count) || 0) + 1;
        break;
      default:
        break;
    }

    const updated = (await this.updateDeliveryExecutions(
      update,
    )) as DeliveryExecutionRecord | DeliveryExecutionRecord[];
    const record = Array.isArray(updated) ? updated[0] : updated;
    if (!record) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `No se pudo actualizar la DeliveryExecution ${executionId}.`,
      );
    }

    // El service NO proyecta a Medusa — a propósito. La proyección al estado
    // comercial (shipped/delivered) vive EXCLUSIVAMENTE en el workflow
    // `src/workflows/transition-delivery-execution.ts`, que tiene container +
    // query.graph para resolver el fulfillment linkeado y ejecuta los workflows
    // core (createOrderShipmentWorkflow / markFulfillmentAsDeliveredWorkflow)
    // con idempotencia sobre shipped_at/delivered_at.
    //
    // Quien quiera transicionar Y proyectar debe invocar ese workflow, no este
    // método directamente. `opts.event` se appendea al sidecar para trazar el
    // origen (evento del carrier) de la transición.
    void opts;

    return record;
  }

  /**
   * Appendea un evento al timeline de una ejecución (APPEND-ONLY) de forma
   * idempotente.
   *
   * Idempotencia: antes de insertar busca un evento existente con el mismo
   * (delivery_execution_id, external_code, occurred_at). Si existe, es no-op y
   * devuelve el existente. Esto cubre el reproceso del poll de Andreani (mismo
   * estadoId + misma marca temporal del evento) sin duplicar filas. El índice
   * único parcial del modelo es la red de seguridad a nivel DB.
   *
   * Eventos sin `external_code` (system/driver) NO se dedupean por esta vía —
   * dos NULL no colisionan en el índice único de Postgres. Para esos, el caller
   * debe garantizar idempotencia (ej. 'created' se appendea una sola vez en el
   * workflow de creación, sobre una ejecución recién creada).
   *
   * Efecto colateral: actualiza `last_event_at` de la ejecución con el
   * `occurred_at` del evento si es más reciente que el actual.
   */
  async appendTrackingEvent(
    input: AppendTrackingEventInput,
  ): Promise<TrackingEventRecord> {
    const occurredAt =
      input.occurred_at instanceof Date
        ? input.occurred_at
        : input.occurred_at
          ? new Date(input.occurred_at)
          : new Date();

    const externalCode = input.external_code ?? null;

    // Dedupe a nivel aplicación: (execution, external_code, occurred_at).
    // Solo aplica cuando hay external_code; sin él no podemos distinguir
    // duplicados y dejamos pasar (caller responsable).
    if (externalCode !== null) {
      const existing = (await this.listTrackingEvents({
        delivery_execution_id: input.delivery_execution_id,
        external_code: externalCode,
        occurred_at: occurredAt,
      })) as TrackingEventRecord[];

      const found = existing[0];
      if (found) {
        return found;
      }
    }

    const created = (await this.createTrackingEvents({
      delivery_execution_id: input.delivery_execution_id,
      source: input.source,
      code: input.code,
      external_code: externalCode,
      description: input.description ?? null,
      occurred_at: occurredAt,
      location: (input.location ?? null) as Record<string, unknown> | null,
      raw: input.raw ?? null,
      metadata: input.metadata ?? null,
    })) as TrackingEventRecord | TrackingEventRecord[];

    const record = Array.isArray(created) ? created[0] : created;
    if (!record) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `No se pudo appendear el TrackingEvent para la ejecución ${input.delivery_execution_id}.`,
      );
    }

    // Avanza last_event_at de la ejecución si este hito es más reciente.
    try {
      const execution = (await this.retrieveDeliveryExecution(
        input.delivery_execution_id,
      )) as DeliveryExecutionRecord & { last_event_at?: Date | null };
      const current = execution.last_event_at
        ? new Date(execution.last_event_at)
        : null;
      if (!current || occurredAt.getTime() > current.getTime()) {
        await this.updateDeliveryExecutions({
          id: input.delivery_execution_id,
          last_event_at: occurredAt,
        });
      }
    } catch {
      // Si la ejecución no existe (evento huérfano), no bloqueamos el append.
    }

    return record;
  }

  /**
   * Captura un ProofOfDelivery (M5) para una ejecución y appendea un
   * TrackingEvent informativo ('proof_captured') al timeline reusando
   * `appendTrackingEvent`.
   *
   * NO valida el PIN ni sube archivos: eso es responsabilidad del caller (el
   * workflow capture-proof-of-delivery valida el PIN y resuelve la file_url;
   * el módulo delivery no maneja binarios). Acá solo persiste la evidencia y
   * deja rastro en el timeline.
   *
   * El gating de 'delivered' (transition()) consulta `hasProofOfDelivery`, así
   * que capturar el POD ANTES de transicionar es lo que habilita la entrega de
   * flota propia.
   */
  async addProofOfDelivery(
    input: AddProofOfDeliveryInput,
  ): Promise<ProofOfDeliveryRecord> {
    if (!isValidProofType(input.type as string)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Tipo de ProofOfDelivery inválido: '${input.type}'.`,
      );
    }

    const capturedAt =
      input.captured_at instanceof Date
        ? input.captured_at
        : input.captured_at
          ? new Date(input.captured_at)
          : new Date();

    const created = (await this.createProofOfDeliveries({
      delivery_execution_id: input.delivery_execution_id,
      type: input.type,
      file_url: input.file_url ?? null,
      signature_url: input.signature_url ?? null,
      captured_lat: input.captured_lat ?? null,
      captured_lng: input.captured_lng ?? null,
      captured_by: input.captured_by ?? null,
      pin_validated: input.pin_validated ?? null,
      note: input.note ?? null,
      captured_at: capturedAt,
      metadata: input.metadata ?? null,
    })) as ProofOfDeliveryRecord | ProofOfDeliveryRecord[];

    const record = Array.isArray(created) ? created[0] : created;
    if (!record) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `No se pudo guardar el ProofOfDelivery para la ejecución ${input.delivery_execution_id}.`,
      );
    }

    // Rastro en el timeline unificado. source 'driver' si lo capturó un driver
    // (geo/foto/firma de la PWA), 'system' para el resto (ej. PIN del CDE).
    // Best-effort: si la ejecución es huérfana, appendTrackingEvent ya tolera el
    // fallo del bump de last_event_at; igual envolvemos por seguridad.
    try {
      const location =
        typeof input.captured_lat === 'number' &&
        typeof input.captured_lng === 'number'
          ? { lat: input.captured_lat, lng: input.captured_lng }
          : null;

      await this.appendTrackingEvent({
        delivery_execution_id: input.delivery_execution_id,
        source: input.type === 'pin' ? 'system' : 'driver',
        code: 'proof_captured',
        description: `Evidencia de entrega capturada (${input.type}).`,
        occurred_at: capturedAt,
        location,
        metadata: { proof_of_delivery_id: record.id, proof_type: input.type },
      });
    } catch {
      // No bloqueamos la captura del POD si el append del timeline falla.
    }

    return record;
  }

  /**
   * True si existe al menos un ProofOfDelivery para `executionId`. Si se pasa
   * `types`, filtra por esos tipos (ej. solo 'pin').
   *
   * Lo usa el gating de 'delivered' (transition) y puede usarse desde workflows
   * para chequeos previos.
   */
  async hasProofOfDelivery(
    executionId: string,
    types?: Array<ProofType | string>,
  ): Promise<boolean> {
    const filters: Record<string, unknown> = {
      delivery_execution_id: executionId,
    };
    if (types && types.length > 0) {
      filters.type = types;
    }

    const found = (await this.listProofOfDeliveries(filters, {
      take: 1,
    })) as ProofOfDeliveryRecord[];

    return Array.isArray(found) && found.length > 0;
  }

  /* ==========================================================================
   * M6 — Zonas logísticas + Motor de reglas
   * ========================================================================*/

  /**
   * Resuelve la zona logística para un punto/sucursal ya resueltos por
   * geometría. La resolución punto→coverage la hace el caller con el service de
   * store-location (resolveByPoint, que REUSA el PolygonEngine); acá solo
   * mapeamos coverage/sucursal → DeliveryZone, sin tocar geometría.
   *
   * Precedencia de matcheo de zona:
   *  1) `zone_id` explícito (cortocircuito).
   *  2) `branch_coverage_id` → zona que referencia ese coverage.
   *  3) `store_location_id` → zona activa de la sucursal de mayor prioridad.
   *
   * Devuelve null si no hay zona configurada para ese punto.
   */
  async resolveZone(
    opts: ResolveDeliveryDecisionOpts,
  ): Promise<DeliveryZoneRecord | null> {
    if (opts.zone_id) {
      const zone = (await this.retrieveDeliveryZone(opts.zone_id).catch(
        () => null,
      )) as DeliveryZoneRecord | null;
      return zone && zone.active ? zone : null;
    }

    if (opts.branch_coverage_id) {
      const byCoverage = (await this.listDeliveryZones(
        { branch_coverage_id: opts.branch_coverage_id, active: true },
        { order: { priority: 'DESC' }, take: 1 },
      )) as DeliveryZoneRecord[];
      if (byCoverage[0]) return byCoverage[0];
    }

    if (opts.store_location_id) {
      const byBranch = (await this.listDeliveryZones(
        { store_location_id: opts.store_location_id, active: true },
        { order: { priority: 'DESC' }, take: 1 },
      )) as DeliveryZoneRecord[];
      if (byBranch[0]) return byBranch[0];
    }

    return null;
  }

  /** Trae las reglas aplicables: las de la zona + las globales (zona null). */
  private async loadApplicableRules(
    zoneId: string | null,
  ): Promise<MaterializedDeliveryRule[]> {
    const filters: Record<string, unknown> = { active: true };
    // Zona específica + globales (delivery_zone_id null). El motor las ordena
    // por priority; una global de mayor prioridad puede ganarle a una de zona.
    filters.delivery_zone_id = zoneId ? [zoneId, null] : [null];

    const rules = (await this.listDeliveryRules(filters, {
      order: { priority: 'DESC' },
    })) as DeliveryRuleRecord[];

    return rules.map((r) => ({
      id: r.id,
      name: r.name,
      delivery_zone_id: r.delivery_zone_id,
      priority: Number(r.priority) || 0,
      conditions: Array.isArray(r.conditions) ? r.conditions : [],
      action:
        r.action && typeof r.action === 'object'
          ? (r.action as MaterializedDeliveryRule['action'])
          : {},
      active: Boolean(r.active),
    }));
  }

  /**
   * Decide provider / estrategia de ruta / recargo / zona para una orden.
   *
   * Pasos:
   *  (a) resuelve la zona (resolveZone) a partir del coverage/sucursal ya
   *      resueltos por store-location (geometría REUSADA, no reimplementada),
   *  (b) trae las reglas de esa zona + las globales,
   *  (c) corre el motor first-match (evaluateRules) sobre el contexto,
   *  (d) devuelve la decisión combinando la action ganadora con los defaults de
   *      la zona (provider habilitado / pricing_tier).
   *
   * Si no hay zona ni reglas, devuelve una decisión neutra (todo null,
   * surcharge 0) — el caller mantiene su clasificación previa.
   */
  async resolveDeliveryDecision(
    context: RuleEvaluationContext,
    opts: ResolveDeliveryDecisionOpts = {},
  ): Promise<DeliveryDecision> {
    const zone = await this.resolveZone(opts);
    const zoneId = zone?.id ?? context.zone_id ?? null;

    // El contexto que ve el motor incluye la zona/pricing_tier resueltos, para
    // que las reglas puedan condicionar por ellos.
    const evalContext: RuleEvaluationContext = {
      ...context,
      zone_id: zoneId,
      pricing_tier: context.pricing_tier ?? zone?.pricing_tier ?? null,
    };

    const rules = await this.loadApplicableRules(zoneId);
    const { matched_rule_id, action } = evaluateRules(evalContext, rules);

    // El provider de la action manda; si la regla no lo fija, no forzamos
    // (null = "el caller decide"). Si la zona restringe providers y la action
    // propone uno no habilitado, lo descartamos (la zona manda sobre la regla
    // en materia de qué se puede operar ahí).
    let providerType: DeliveryProviderType | null =
      (action.assign_provider as DeliveryProviderType | undefined) ?? null;
    const enabled = Array.isArray(zone?.enabled_providers)
      ? (zone!.enabled_providers as string[])
      : null;
    if (providerType && enabled && !enabled.includes(providerType)) {
      providerType = null;
    }

    // F5: propagamos la estrategia de asignación y el flag auto_assign de la
    // regla ganadora. Solo aceptamos una assign_strategy válida; cualquier otra
    // cosa la dejamos null para que el caller caiga al fallback por precedencia.
    const rawStrategy = action.assign_strategy;
    const assignStrategy: AssignStrategy | null =
      typeof rawStrategy === 'string' && isValidAssignStrategy(rawStrategy)
        ? rawStrategy
        : null;

    return {
      zone_id: zoneId,
      provider_type: providerType,
      service_mode:
        (action.service_mode as DeliveryServiceMode | undefined) ?? null,
      route_strategy:
        (action.route_strategy as RouteStrategy | undefined) ?? null,
      surcharge: typeof action.surcharge === 'number' ? action.surcharge : 0,
      matched_rule_id,
      assign_strategy: assignStrategy,
      auto_assign:
        typeof action.auto_assign === 'boolean' ? action.auto_assign : null,
    };
  }

  /**
   * Resuelve la estrategia de asignación efectiva por PRECEDENCIA (F5):
   *
   *   1) decision.assign_strategy  — fijada por la regla de despacho ganadora.
   *   2) zone.metadata.default_assign_strategy — default configurado por zona.
   *   3) DEFAULT_ASSIGN_STRATEGY   — fallback global ('least_load').
   *
   * Un override manual (ej. el body del endpoint auto-assign) lo aplica el
   * caller ANTES de llamar acá; este helper resuelve la configuración persistida.
   * Devuelve siempre una estrategia válida (nunca null).
   */
  resolveAssignStrategy(
    decision: Pick<DeliveryDecision, 'assign_strategy'> | null,
    zone: { metadata?: unknown } | null,
  ): AssignStrategy {
    const fromRule = decision?.assign_strategy ?? null;
    if (fromRule && isValidAssignStrategy(fromRule)) return fromRule;

    const meta =
      zone && typeof zone.metadata === 'object' && zone.metadata
        ? (zone.metadata as Record<string, unknown>)
        : null;
    const fromZone = meta?.default_assign_strategy;
    if (typeof fromZone === 'string' && isValidAssignStrategy(fromZone)) {
      return fromZone;
    }

    return DEFAULT_ASSIGN_STRATEGY;
  }

  /* ==========================================================================
   * M9 — Control Tower / Delivery Analytics (solo lectura)
   * ========================================================================*/

  /**
   * Acceso a knex igual que commerce-dashboard. La lógica de agregación vive en
   * analytics.ts (funciones puras que reciben el knex) para mantener este
   * service liviano y los tests aislables.
   */
  private get analyticsKnex() {
    return (this as any).__container__.manager.getKnex();
  }

  /**
   * KPIs operativos del Control Tower sobre un rango de fechas: tasa de entrega,
   * intentos fallidos, SLA dispatched→delivered, breakdowns por
   * status/provider/service_mode/zona/driver y timeseries diaria. On-the-fly
   * sobre delivery_execution + delivery_zone + driver (sin modelos nuevos).
   */
  async getDeliveryMetrics(
    filters: DeliveryMetricsFilters,
  ): Promise<DeliveryMetrics> {
    return computeDeliveryMetrics(this.analyticsKnex, filters);
  }

  /* ==========================================================================
   * Flota propia — Elegibilidad de recursos (drivers / vehicles)
   * ========================================================================*/

  /**
   * Resuelve los recursos de flota propia (drivers / vehicles) ELEGIBLES para una
   * DeliveryExecution. SOLO LECTURA: no asigna ni muta nada.
   *
   * IMPORTANTE — DE DÓNDE SALE `orderAggregate`:
   *   El container de un MÓDULO está AISLADO y NO tiene `query`
   *   (ContainerRegistrationKeys.QUERY); query.graph solo existe en el container
   *   principal (workflows / API routes / subscribers). Por eso el agregado de la
   *   orden (peso/conteo/temperatura/volumen) lo computa el CALL SITE con
   *   fetchExecutionOrderAggregate(query, executionId) (ver ./order-query) y se lo
   *   pasa a este método YA resuelto. El service NO resuelve QUERY.
   *
   * Pipeline:
   *  1) Carga la ejecución. Si NO es 'own_fleet' devuelve vacío (la elegibilidad
   *     de flota no aplica a Andreani / store_pickup — esos no usan pool propio).
   *  2) Arma el FleetRequirement con el `orderAggregate` recibido (peso, conteo,
   *     temperatura, volumen) + la zona/horario de la ejecución.
   *  3) Trae drivers/vehicles activos de la sucursal + sus turnos + las
   *     asignaciones de zona (ZoneResource).
   *  4) Calcula la carga actual de cada driver (DeliveryExecution no terminales).
   *  5) Resuelve las zonas habilitadas por recurso (semántica null vs []).
   *  6) Delega la decisión en selectEligible (función pura).
   *
   * SEMÁNTICA DE ZONA (paso 5):
   *  - Si la zona de la ejecución NO tiene NINGUNA fila ZoneResource de un
   *    resource_type ('driver' o 'vehicle'), TODOS los recursos de ese tipo van
   *    con zone_ids=null → NO restringidos por zona (el operador no configuró
   *    restricción de zona para ese tipo, así que cualquiera sirve).
   *  - Si la zona SÍ tiene filas de ese tipo, cada recurso lleva zone_ids=[zoneId]
   *    si está mapeado, o [] (restringido y sin esta zona → excluido) si no.
   *  Esto evita que activar el ruteo por zona para drivers excluya de golpe a los
   *  vehículos (y viceversa): la restricción es por tipo, no global.
   */
  async getEligibleResources(
    executionId: string,
    orderAggregate: ExecutionOrderAggregate,
  ): Promise<EligibilityResult> {
    const empty: EligibilityResult = {
      eligible_drivers: [],
      eligible_vehicles: [],
      rejected: [],
    };

    const execution = (await this.retrieveDeliveryExecution(
      executionId,
    )) as DeliveryExecutionRecord & {
      store_location_id?: string | null;
      delivery_zone_id?: string | null;
      provider_type?: string | null;
    };

    // La elegibilidad de flota SOLO aplica a own_fleet. Andreani / store_pickup
    // no consumen el pool propio: devolvemos vacío (no es un error de input).
    if (execution.provider_type !== 'own_fleet') {
      return empty;
    }

    const storeLocationId = execution.store_location_id ?? null;
    const zoneId = execution.delivery_zone_id ?? null;

    // 2) FleetRequirement: el agregado de la orden (peso, conteo, temperatura,
    //    volumen) lo computa el CALL SITE con query.graph (ver ./order-query) y
    //    lo recibimos como `orderAggregate`. El module container NO tiene QUERY.
    const now = new Date();
    const requirement: FleetRequirement = {
      weight_kg: orderAggregate.weight_kg,
      volume_m3: orderAggregate.volume_m3,
      item_count: orderAggregate.item_count,
      temperature: orderAggregate.temperature,
      zone_id: zoneId,
      now_hhmm: `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes(),
      ).padStart(2, '0')}`,
      day_of_week: now.getDay(),
    };

    // 3) Drivers y vehicles activos de la sucursal. store_location_id null →
    //    sin sucursal resuelta: el filtro queda sin esa restricción.
    //    Driver sigue siendo mono-sucursal (columna directa). Vehicle es
    //    multi-sucursal (store_location_ids json): no se puede filtrar por
    //    "contiene" en el query generado, así que traemos los activos y
    //    filtramos por membresía en memoria (flota chica).
    const driverFilters: Record<string, unknown> = { active: true };
    if (storeLocationId) {
      driverFilters.store_location_id = storeLocationId;
    }

    const driverRows = (await this.listDrivers(driverFilters)) as Array<
      Record<string, unknown>
    >;
    const allVehicleRows = (await this.listVehicles({ active: true })) as Array<
      Record<string, unknown>
    >;
    const vehicleRows = storeLocationId
      ? allVehicleRows.filter(
          (v) =>
            Array.isArray(v.store_location_ids) &&
            (v.store_location_ids as string[]).includes(storeLocationId),
        )
      : allVehicleRows;

    const driverIds = driverRows
      .map((d) => (typeof d.id === 'string' ? d.id : null))
      .filter((id): id is string => Boolean(id));
    const vehicleIds = vehicleRows
      .map((v) => (typeof v.id === 'string' ? v.id : null))
      .filter((id): id is string => Boolean(id));

    // Turnos activos de esos drivers.
    const shiftRows = driverIds.length
      ? ((await this.listDriverShifts({
          driver_id: driverIds,
          active: true,
        })) as Array<Record<string, unknown>>)
      : [];
    const shiftsByDriver = new Map<
      string,
      { day_of_week: number; start_time: string; end_time: string; active: boolean }[]
    >();
    for (const s of shiftRows) {
      const did = typeof s.driver_id === 'string' ? s.driver_id : null;
      if (!did) continue;
      const list = shiftsByDriver.get(did) ?? [];
      list.push({
        day_of_week: Number(s.day_of_week),
        start_time: String(s.start_time ?? ''),
        end_time: String(s.end_time ?? ''),
        active: Boolean(s.active),
      });
      shiftsByDriver.set(did, list);
    }

    // 4) Carga actual por driver: DeliveryExecution NO terminales asignadas.
    const loadByDriver = new Map<string, number>();
    if (driverIds.length) {
      const activeExecutions = (await this.listDeliveryExecutions(
        {
          driver_id: driverIds,
          status: { $nin: [...DELIVERY_TERMINAL_STATUSES] },
        },
        { select: ['id', 'driver_id', 'status'] },
      )) as Array<Record<string, unknown>>;
      for (const e of activeExecutions) {
        const did = typeof e.driver_id === 'string' ? e.driver_id : null;
        if (!did) continue;
        loadByDriver.set(did, (loadByDriver.get(did) ?? 0) + 1);
      }
    }

    // 5) Zonas habilitadas por recurso desde ZoneResource (solo de esta zona).
    let driverZoneIds: ((id: string) => string[] | null) = () => null;
    let vehicleZoneIds: ((id: string) => string[] | null) = () => null;
    if (zoneId) {
      const zoneRows = (await this.listZoneResources({
        delivery_zone_id: zoneId,
        active: true,
      })) as Array<Record<string, unknown>>;

      const driverMapped = new Set<string>();
      const vehicleMapped = new Set<string>();
      let hasDriverRows = false;
      let hasVehicleRows = false;
      for (const z of zoneRows) {
        const rt = z.resource_type;
        const rid = typeof z.resource_id === 'string' ? z.resource_id : null;
        if (rt === 'driver') {
          hasDriverRows = true;
          if (rid) driverMapped.add(rid);
        } else if (rt === 'vehicle') {
          hasVehicleRows = true;
          if (rid) vehicleMapped.add(rid);
        }
      }

      // Si NO hay filas de un tipo → null (sin restricción para ese tipo).
      // Si hay → [zoneId] si mapeado, [] si no.
      driverZoneIds = hasDriverRows
        ? (id: string) => (driverMapped.has(id) ? [zoneId] : [])
        : () => null;
      vehicleZoneIds = hasVehicleRows
        ? (id: string) => (vehicleMapped.has(id) ? [zoneId] : [])
        : () => null;
    }

    // Materialización de candidatos para la función pura.
    const drivers: DriverCandidate[] = driverRows.map((d) => {
      const id = String(d.id);
      return {
        id,
        status: String(d.status ?? 'offline'),
        active: Boolean(d.active),
        max_active_deliveries:
          d.max_active_deliveries == null
            ? null
            : Number(d.max_active_deliveries),
        active_deliveries: loadByDriver.get(id) ?? 0,
        shifts: shiftsByDriver.get(id) ?? [],
        zone_ids: driverZoneIds(id),
      };
    });

    const vehicles: VehicleCandidate[] = vehicleRows.map((v) => {
      const id = String(v.id);
      return {
        id,
        active: Boolean(v.active),
        type: String(v.type ?? ''),
        capacity_kg: v.capacity_kg == null ? null : Number(v.capacity_kg),
        capacity_m3: v.capacity_m3 == null ? null : Number(v.capacity_m3),
        max_orders: v.max_orders == null ? null : Number(v.max_orders),
        has_refrigeration: Boolean(v.has_refrigeration),
        temperature_modes: Array.isArray(v.temperature_modes)
          ? (v.temperature_modes as unknown[]).map(String)
          : null,
        zone_ids: vehicleZoneIds(id),
      };
    });

    void vehicleIds; // ids ya usados a través de vehicleRows.

    // 6) Decisión pura.
    return selectEligible(drivers, vehicles, requirement);
  }
}

export default DeliveryModuleService;
