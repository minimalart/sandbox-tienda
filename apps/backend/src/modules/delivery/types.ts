/**
 * Mercatto Delivery — capa de ejecución logística sobre Medusa v2.
 *
 * `DeliveryExecution` es un SIDECAR operativo 1:1 de un Fulfillment de Medusa,
 * vinculado vía defineLink. NO copia line items, direcciones ni montos: esos se
 * leen en vivo con query.graph a través del link. El Fulfillment de Medusa sigue
 * siendo la fuente de verdad del estado comercial (shipped/delivered); la
 * DeliveryExecution solo es dueña del estado OPERATIVO fino (asignación,
 * intentos de entrega, ventana programada, zona, etc.).
 */

export const DELIVERY_MODULE = 'delivery';

/**
 * Quién ejecuta físicamente la entrega.
 *
 * Al sumar un carrier hay que revisar TRES lugares, no solo este union:
 *  1. `POD_REQUIRED_PROVIDER_TYPES` (más abajo) — ¿exige prueba de entrega?
 *  2. `providers/registry.ts` — registrar el adapter, o `getDeliveryProvider`
 *     tira NOT_FOUND en runtime.
 *  3. `classify()` en `workflows/.../create-delivery-execution.ts` — sin una
 *     rama explícita, el carrier nuevo cae al fallback `own_fleet` EN SILENCIO
 *     y sus envíos aparecen como flota propia.
 *
 * (`DELIVERY_TRANSITIONS` está indexado por estado, no por provider, así que
 * ese no hace falta tocarlo.)
 */
export type DeliveryProviderType =
  | 'andreani'
  | 'correo_argentino'
  | 'own_fleet'
  | 'store_pickup';

/** Modalidad de servicio (cómo recibe el cliente). */
export type DeliveryServiceMode =
  | 'home_delivery'
  | 'hop'
  | 'branch_pickup'
  | 'store_pickup';

/** Estado de disponibilidad operativa de un repartidor de flota propia. */
export type DriverStatus = 'available' | 'on_route' | 'offline';

/** Tipo de vehículo de flota propia. */
export type VehicleType = 'motorcycle' | 'van' | 'truck' | 'car';

/**
 * Tipo de recurso de flota propia asignable a una zona (ZoneResource).
 * 'driver' → Driver; 'vehicle' → Vehicle.
 */
export type ResourceType = 'driver' | 'vehicle';

export const RESOURCE_TYPES: ResourceType[] = ['driver', 'vehicle'];

/**
 * Modo de temperatura de un producto / capacidad de un vehículo.
 *
 * Se LEE del metadata nativo del producto/variante (variant.metadata.temperature,
 * fallback product.metadata.temperature); NUNCA se modela como atributo, tabla o
 * categoría custom. Orden de severidad de frío: frozen > refrigerated > ambient.
 */
export type TemperatureMode = 'ambient' | 'refrigerated' | 'frozen';

export const TEMPERATURE_MODES: TemperatureMode[] = [
  'ambient',
  'refrigerated',
  'frozen',
];

/**
 * Severidad de cada modo (mayor = más frío). Usado para resolver el requerimiento
 * de temperatura de una orden como el MÁXIMO de frío de sus items.
 */
export const TEMPERATURE_SEVERITY: Record<TemperatureMode, number> = {
  ambient: 0,
  refrigerated: 1,
  frozen: 2,
};

/** True si `mode` es un TemperatureMode válido. */
export const isValidTemperatureMode = (
  mode: string,
): mode is TemperatureMode =>
  (TEMPERATURE_MODES as string[]).includes(mode);

/**
 * Estado operativo fino. Convive con el estado comercial del Fulfillment de
 * Medusa (shipped_at / delivered_at / canceled_at), no lo reemplaza.
 */
export type DeliveryExecutionStatus =
  | 'pending'
  | 'ready'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'at_pickup_point'
  | 'delivered'
  | 'failed_attempt'
  | 'canceled';

/** Estados terminales: no admiten transiciones de salida. */
export const DELIVERY_TERMINAL_STATUSES: DeliveryExecutionStatus[] = [
  'delivered',
  'canceled',
];

/**
 * State machine de la ejecución. Mapa de transiciones permitidas
 * (estado actual → estados destino válidos). Exportado para reuso en el
 * service y en tests.
 *
 * Notas de diseño:
 *  - `failed_attempt` puede reintentar (vuelve a in_transit/at_pickup_point) o
 *    abortarse (canceled).
 *  - Cualquier estado no terminal puede cancelarse.
 *  - `at_pickup_point` aplica a hop/branch/store: el paquete llegó al punto y
 *    espera retiro; desde ahí se entrega o se vuelve a fallar.
 *  - Carriers externos (Andreani) avanzan el envío SIN pasar por la asignación
 *    interna: pueden reportar `picked_up`/`in_transit` (o, en una entrega
 *    relámpago, `delivered`) de golpe sobre una ejecución todavía `pending`/
 *    `ready`. Por eso esos estados admiten saltar directo a los hitos de
 *    tránsito/entrega, además de la ruta operativa manual. Esto preserva el
 *    comportamiento del job de tracking, que proyectaba shipped/delivered sin
 *    importar el estado operativo previo.
 *  - `pending`/`ready`/`assigned` → `failed_attempt` existe por CORREO ARGENTINO.
 *    Su normalizador de tracking mapea `caduco` (`CAU`) y `devolución` a
 *    `failed_attempt` (y NO a `canceled`, que es terminal), y esos eventos
 *    pueden llegar sobre una ejecución que la máquina nunca avanzó: el paquete
 *    caducó sin que Correo lo admitiera nunca (`preImposición` proyecta a
 *    `status: null`, así que la ejecución sigue en `pending`). Sin esta arista
 *    `service.transition()` tira NOT_ALLOWED, el job lo loguea como warning y
 *    reintenta la misma transición imposible cada hora, para siempre. Andreani
 *    no la necesitaba porque su normalizador nunca devuelve `failed_attempt`.
 */
export const DELIVERY_TRANSITIONS: Record<
  DeliveryExecutionStatus,
  DeliveryExecutionStatus[]
> = {
  pending: ['ready', 'assigned', 'picked_up', 'in_transit', 'at_pickup_point', 'delivered', 'failed_attempt', 'canceled'],
  ready: ['assigned', 'picked_up', 'in_transit', 'at_pickup_point', 'delivered', 'failed_attempt', 'canceled'],
  assigned: ['picked_up', 'in_transit', 'at_pickup_point', 'delivered', 'failed_attempt', 'canceled'],
  picked_up: ['in_transit', 'at_pickup_point', 'delivered', 'failed_attempt', 'canceled'],
  in_transit: ['at_pickup_point', 'delivered', 'failed_attempt', 'canceled'],
  at_pickup_point: ['delivered', 'failed_attempt', 'canceled'],
  failed_attempt: ['in_transit', 'at_pickup_point', 'assigned', 'delivered', 'canceled'],
  delivered: [],
  canceled: [],
};

/**
 * Tipo de evidencia de una entrega (M5 — ProofOfDelivery).
 *  - 'photo'     → foto del paquete entregado.
 *  - 'signature' → firma del receptor.
 *  - 'pin'       → validación por PIN (flujo CDE / store_pickup).
 *  - 'geo'       → captura de geolocalización.
 *  - 'note'      → nota de texto del repartidor.
 */
export type ProofType = 'photo' | 'signature' | 'pin' | 'geo' | 'note';

export const PROOF_TYPES: ProofType[] = [
  'photo',
  'signature',
  'pin',
  'geo',
  'note',
];

/** True si `type` es un ProofType válido. */
export const isValidProofType = (type: string): type is ProofType =>
  (PROOF_TYPES as string[]).includes(type);

/**
 * Provider types que EXIGEN un ProofOfDelivery antes de marcar 'delivered'.
 *
 * Por qué solo 'own_fleet':
 *  - 'own_fleet': la entrega la confirma un repartidor de la PWA, que SÍ puede
 *    capturar evidencia (foto/firma/geo) en el momento. Exigir POD acá es la
 *    garantía operativa de que hubo entrega real.
 *  - 'andreani' y 'correo_argentino': la entrega la confirma el CARRIER vía su
 *    tracking (no hay repartidor nuestro capturando nada). El job de tracking
 *    proyecta 'delivered' sin POD posible — exigirlo rompería los dos carriers.
 *    POR ESO se excluyen. No es una omisión: son transportistas de tercero, no
 *    flota propia, y no tenemos forma de exigirle una foto o un PIN al repartidor
 *    de Correo. Exigirlo dejaría toda ejecución de Correo trabada en
 *    `in_transit` para siempre, porque el POD nunca va a llegar.
 *  - 'store_pickup': el retiro en CDE se valida por PIN; ese PIN se registra
 *    como POD type 'pin' en el mismo flujo de validación. No pasa por la PWA del
 *    driver, así que NO se gatea acá (su evidencia es el POD 'pin', que el flujo
 *    de validate-pickup crea de forma aditiva).
 *
 * El gating se aplica en service.transition() leyendo provider_type de la
 * ejecución. Si en el futuro se quiere exigir POD a store_pickup por una vía
 * distinta, agregarlo acá.
 */
export const POD_REQUIRED_PROVIDER_TYPES: DeliveryProviderType[] = ['own_fleet'];

/** True si `providerType` exige POD para poder marcar 'delivered'. */
export const requiresProofOfDelivery = (providerType: string): boolean =>
  (POD_REQUIRED_PROVIDER_TYPES as string[]).includes(providerType);

/** True si `status` es terminal (no admite salida). */
export const isTerminalDeliveryStatus = (
  status: string,
): status is DeliveryExecutionStatus =>
  (DELIVERY_TERMINAL_STATUSES as string[]).includes(status);

/** True si la transición `from → to` está permitida por la state machine. */
export const isValidDeliveryTransition = (from: string, to: string): boolean => {
  const allowed = DELIVERY_TRANSITIONS[from as DeliveryExecutionStatus];
  return Array.isArray(allowed) && allowed.includes(to as DeliveryExecutionStatus);
};

/* ============================================================================
 * M7 — Route Planner (rutas de flota propia + paradas ordenadas)
 * ==========================================================================*/

/**
 * Estado de una Route.
 *  - 'planned'     → ruta armada, paradas definidas, todavía no despachada.
 *  - 'dispatched'  → despachada: driver/vehicle propagados a las ejecuciones.
 *  - 'in_progress' → el driver arrancó el recorrido.
 *  - 'completed'   → todas las paradas resueltas.
 *  - 'canceled'    → ruta abortada.
 */
export type RouteStatus =
  | 'planned'
  | 'dispatched'
  | 'in_progress'
  | 'completed'
  | 'canceled';

export const ROUTE_STATUSES: RouteStatus[] = [
  'planned',
  'dispatched',
  'in_progress',
  'completed',
  'canceled',
];

/** Estados terminales de una ruta (no admiten re-despacho). */
export const ROUTE_TERMINAL_STATUSES: RouteStatus[] = ['completed', 'canceled'];

/** True si `status` es un estado de ruta terminal. */
export const isTerminalRouteStatus = (status: string): boolean =>
  (ROUTE_TERMINAL_STATUSES as string[]).includes(status);

/**
 * Estado de una RouteStop (parada).
 *  - 'pending'   → todavía no visitada.
 *  - 'arrived'   → el driver llegó al punto.
 *  - 'completed' → entrega resuelta con éxito.
 *  - 'failed'    → intento fallido en la parada.
 */
export type RouteStopStatus = 'pending' | 'arrived' | 'completed' | 'failed';

export const ROUTE_STOP_STATUSES: RouteStopStatus[] = [
  'pending',
  'arrived',
  'completed',
  'failed',
];

/* ============================================================================
 * M6 — Zonas logísticas + Motor de reglas
 * ==========================================================================*/

/** Estrategia de ruteo que puede imponer una regla. */
export type RouteStrategy = 'auto' | 'manual' | 'optimized';

export const ROUTE_STRATEGIES: RouteStrategy[] = ['auto', 'manual', 'optimized'];

/**
 * Operadores soportados por el motor de reglas (rules-engine.ts).
 *  - eq / neq        → igualdad (boolean-aware y string-aware).
 *  - gt / gte / lt / lte → comparación numérica.
 *  - in / nin        → pertenencia a un array (value debe ser array).
 *  - between         → value es [min, max]; numérico o lexicográfico ('HH:mm').
 *  - contains        → el field (string o array) contiene a value.
 */
export type RuleOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'between'
  | 'contains';

export const RULE_OPERATORS: RuleOperator[] = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'nin',
  'between',
  'contains',
];

/** Campos evaluables, derivados de la orden + zona resuelta. */
export type RuleField =
  | 'weight_kg'
  | 'order_total'
  | 'item_count'
  | 'sku'
  | 'skus'
  | 'postal_code'
  | 'time_of_day'
  | 'zone_id'
  | 'pricing_tier'
  | 'temperature';

export const RULE_FIELDS: RuleField[] = [
  'weight_kg',
  'order_total',
  'item_count',
  'sku',
  'skus',
  'postal_code',
  'time_of_day',
  'zone_id',
  'pricing_tier',
  'temperature',
];

/** Valor primitivo o array admitido del lado derecho de un predicado. */
export type RulePredicateValue =
  | string
  | number
  | boolean
  | Array<string | number>;

/** Un predicado individual de una regla. */
export interface RulePredicate {
  field: RuleField | string;
  op: RuleOperator;
  value: RulePredicateValue;
}

/**
 * Estrategia de asignación automática de flota propia (paso F5). Define a quién
 * elegir entre los recursos elegibles. La lógica pura vive en
 * assignment-strategies.ts; acá solo es el contrato del enum.
 */
export type AssignStrategy = 'round_robin' | 'first_available' | 'least_load';

export const ASSIGN_STRATEGIES: AssignStrategy[] = [
  'round_robin',
  'first_available',
  'least_load',
];

/** Estrategia de asignación por defecto a nivel global (último fallback). */
export const DEFAULT_ASSIGN_STRATEGY: AssignStrategy = 'least_load';

/** Acción que aplica la PRIMERA regla que matchea. */
export interface RuleAction {
  /** provider_type a forzar (ver DeliveryProviderType). */
  assign_provider?: DeliveryProviderType | string;
  /** Estrategia de ruteo a imponer. */
  route_strategy?: RouteStrategy | string;
  /** Recargo a aplicar, en la menor unidad monetaria (ej. centavos). */
  surcharge?: number;
  /** service_mode a forzar (opcional; refina la modalidad de entrega). */
  service_mode?: DeliveryServiceMode | string;
  /** Estrategia de asignación de flota propia a usar (F5). */
  assign_strategy?: AssignStrategy | string;
  /** Si true, habilita la asignación automática de flota propia (F5). */
  auto_assign?: boolean;
}

/**
 * Contexto de evaluación derivado de la orden + zona. El motor lee SOLO de acá;
 * no toca DB ni query.graph (es una función pura, testeable en aislamiento).
 */
export interface RuleEvaluationContext {
  weight_kg?: number | null;
  order_total?: number | null;
  item_count?: number | null;
  skus?: string[];
  postal_code?: string | null;
  /** Hora local 'HH:mm' del momento de evaluación (para cutoff / ventanas). */
  time_of_day?: string | null;
  zone_id?: string | null;
  pricing_tier?: string | null;
  /**
   * Requerimiento de temperatura de la orden = el MÁXIMO de frío de sus items,
   * leído del metadata nativo del producto/variante. Default 'ambient'.
   */
  temperature?: TemperatureMode | null;
}

/** Una regla materializada (forma persistida de DeliveryRule). */
export interface MaterializedDeliveryRule {
  id: string;
  name: string;
  delivery_zone_id: string | null;
  priority: number;
  conditions: RulePredicate[];
  action: RuleAction;
  active: boolean;
}

/** Resultado de evaluar el set de reglas (regla ganadora + su acción). */
export interface RuleEvaluationResult {
  matched_rule_id: string | null;
  action: RuleAction;
}

/** Decisión final de despacho que devuelve resolveDeliveryDecision. */
export interface DeliveryDecision {
  zone_id: string | null;
  provider_type: DeliveryProviderType | null;
  service_mode: DeliveryServiceMode | null;
  route_strategy: RouteStrategy | null;
  surcharge: number;
  matched_rule_id: string | null;
  /**
   * Estrategia de asignación propagada de la regla ganadora (F5). null = la
   * regla no la fijó → el caller resuelve por precedencia (ver
   * resolveAssignStrategy en el service).
   */
  assign_strategy: AssignStrategy | null;
  /** auto_assign propagado de la regla ganadora (F5). null = no fijado. */
  auto_assign: boolean | null;
}

/** True si `op` es un operador de regla válido. */
export const isValidRuleOperator = (op: string): op is RuleOperator =>
  (RULE_OPERATORS as string[]).includes(op);
