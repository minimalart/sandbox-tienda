/**
 * Lógica pura del admin de Correo Argentino.
 *
 * Vive fuera de los componentes por una razón concreta: el admin de este backend
 * NO tiene runner de tests de componentes React, pero `pnpm test` sí levanta
 * `node:test` sobre todos los `.test.ts` de `src`. Todo lo que es una decisión
 * (¿este envío es de Correo?, ¿el peso volumétrico le ganó al real?, ¿cuántos
 * rótulos del lote fallaron?) se extrae acá y se testea de verdad; en los `.tsx`
 * queda solo el render.
 *
 * Sin imports de React ni de `@medusajs/*` a propósito: si este archivo
 * importara un `.tsx` el runner no lo podría levantar.
 */

/** URL pública de seguimiento de Correo (misma que usa el backend y el storefront). */
export const CORREO_PUBLIC_TRACKING_URL =
  'https://www.correoargentino.com.ar/formularios/e-commerce?id=';

export function correoPublicTrackingUrl(trackingNumber: string): string {
  return `${CORREO_PUBLIC_TRACKING_URL}${encodeURIComponent(trackingNumber)}`;
}

// ─── Detección del carrier ───────────────────────────────────────────────────

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readString(source: unknown, key: string): string | undefined {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function deaccent(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * ¿El nombre de la opción menciona Correo como palabra completa?
 *
 * El límite de palabra NO es cosmético: "correo" es una palabra corriente en
 * castellano ("te avisamos por correo", "correo electrónico"), así que un
 * `includes('correo')` clasificaría como envío de Correo Argentino cualquier
 * opción que la mencione al pasar.
 */
export function hasCorreoNameHint(value: string | undefined): boolean {
  if (!value) return false;
  return /\bcorreo\b/.test(deaccent(value));
}

/**
 * ¿Este shipping method es de Correo Argentino?
 *
 * ⚠️ FUENTE DE VERDAD: `isCorreoShippingMethod()` en
 * `src/workflows/correo-generate-tickets.ts`. Esto es una RÉPLICA con la MISMA
 * precedencia, no una variante: el admin no puede importar del workflow (se
 * bundlea con Vite para el browser y arrastraría el módulo entero del carrier).
 * Si cambia la precedencia allá, cambia acá.
 *
 * Precedencia, explícito → inferido:
 *   1. `provider_id` contiene `correo_argentino`
 *   2. `data.provider` / `data.carrier` === `correo_argentino` | `correo`
 *   3. `data.id` empieza con `correo-` (la fulfillment option del seed)
 *   4. `data.provider_id` contiene `correo_argentino`
 *   5. el NOMBRE menciona `correo` como palabra completa (último recurso)
 *
 * Nunca al revés: el nombre lo escribe una persona en el admin y es lo único
 * que puede estar mal sin que nada más lo delate.
 */
export function isCorreoShippingMethodLike(method: unknown): boolean {
  const provider = readString(method, 'provider_id');
  if (provider?.toLowerCase().includes('correo_argentino')) return true;

  const data = isRecord(method) ? method.data : undefined;

  for (const key of ['provider', 'carrier']) {
    const value = readString(data, key)?.toLowerCase();
    if (value === 'correo_argentino' || value === 'correo') return true;
  }

  const optionId = readString(data, 'id')?.toLowerCase();
  if (optionId?.startsWith('correo-')) return true;

  const dataProvider = readString(data, 'provider_id')?.toLowerCase();
  if (dataProvider?.includes('correo_argentino')) return true;

  return hasCorreoNameHint(readString(method, 'name'));
}

/**
 * ¿Este fulfillment nativo es de Correo?
 *
 * Espeja `isCorreoFulfillment()` de
 * `src/modules/correo-argentino-fulfillment/utils/list-fulfillments.ts`, que es
 * ESTRICTA a propósito: `provider_id` o `data.carrier`, nunca "cualquier
 * fulfillment con tracking_number" (ese criterio de Andreani, con dos carriers,
 * haría que cada uno se robara los envíos del otro).
 */
export function isCorreoFulfillmentLike(fulfillment: unknown): boolean {
  const provider = readString(fulfillment, 'provider_id');
  if (provider?.toLowerCase().includes('correo_argentino')) return true;

  const data = isRecord(fulfillment) ? fulfillment.data : undefined;
  return readString(data, 'carrier')?.toLowerCase() === 'correo_argentino';
}

// ─── Pesos ───────────────────────────────────────────────────────────────────

/**
 * Gramos → texto para el operador. Bajo 1 kg en gramos (es como se piensan los
 * paquetes chicos); de 1 kg para arriba en kg con un decimal.
 */
export function formatGrams(grams: unknown): string {
  // Coerción EXPLÍCITA en vez de `Number(grams)` pelado: `Number(null)` y
  // `Number([])` son `0`, así que un peso ausente se mostraría como "0 g" —
  // indistinguible de un paquete que de verdad pesa cero. Un dato que falta se
  // muestra como falta.
  const value =
    typeof grams === 'number'
      ? grams
      : typeof grams === 'string' && grams.trim() !== ''
        ? Number(grams)
        : Number.NaN;

  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1000) return `${Math.round(value)} g`;
  const kg = value / 1000;
  // Coma decimal: es un admin en es-AR.
  return `${kg.toFixed(kg % 1 === 0 ? 0 : 1).replace('.', ',')} kg`;
}

export interface CorreoBilledWeight {
  product_g: number;
  volumetric_g: number;
  billed_g: number;
  /**
   * `true` = el peso volumétrico le ganó al real, o sea que Correo va a facturar
   * MÁS de lo que pesa el paquete. Es el dato operativo que justifica mostrar los
   * dos números en vez de uno.
   */
  volumetric_wins: boolean;
  /** Cuánto de más se factura por el aforo. `0` cuando no aplica. */
  surcharge_g: number;
}

/**
 * Compara peso real vs facturado de un `parcel` de ticket.
 *
 * No recalcula el volumétrico: usa el que el workflow ya persistió (el aforo es
 * configurable por env var y recomputarlo acá lo desincronizaría).
 */
export function describeBilledWeight(parcel: unknown): CorreoBilledWeight {
  const num = (key: string): number => {
    const raw = isRecord(parcel) ? parcel[key] : undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  };

  const product_g = num('product_weight_g');
  const volumetric_g = num('volumetric_weight_g');
  // Si `billed_weight_g` no vino, se deriva del máximo — pero NO se sobreescribe
  // el valor persistido cuando existe.
  const billedRaw = num('billed_weight_g');
  const billed_g = billedRaw > 0 ? billedRaw : Math.max(product_g, volumetric_g);

  const volumetric_wins = billed_g > product_g && volumetric_g > product_g;

  return {
    product_g,
    volumetric_g,
    billed_g,
    volumetric_wins,
    surcharge_g: volumetric_wins ? billed_g - product_g : 0,
  };
}

// ─── Resultado por ítem de `/labels` ─────────────────────────────────────────

/**
 * Ítem de rótulo tal como lo devuelve `POST /admin/correo-argentino/labels`.
 * Espeja `CorreoLabelResponseItem` de `src/api/admin/correo-argentino/_label-response.ts`.
 */
export interface CorreoLabelOutcome {
  tracking_number: string;
  ok: boolean;
  file_name: string | null;
  base64: string | null;
  error: string | null;
}

/**
 * Ítem de rótulo en cualquiera de las DOS formas reales que puede tomar:
 *
 *  - con `base64`, cuando la ruta devolvió el JSON por ítem (2+ TNs)
 *  - con `bytes`, cuando devolvió el PDF directo (1 solo TN: la ruta corta el
 *    JSON y responde `application/pdf`)
 *
 * Un solo tipo para las dos porque la pregunta "¿este ítem trae el archivo?" es
 * la misma, y duplicar el resumen en dos funciones es cómo los dos caminos
 * empiezan a contar distinto.
 */
export interface CorreoLabelLike {
  tracking_number: string;
  ok: boolean;
  error: string | null;
  base64?: string | null;
  bytes?: { length: number } | null;
}

/** ¿El ítem trae el PDF de verdad? */
export function correoLabelHasFile(label: CorreoLabelLike): boolean {
  if (typeof label.base64 === 'string' && label.base64.trim().length > 0) {
    return true;
  }
  return (label.bytes?.length ?? 0) > 0;
}

export interface CorreoLabelSummary {
  total: number;
  ok_count: number;
  error_count: number;
  /** `true` = salieron todos. */
  all_ok: boolean;
  /** `true` = no salió ninguno. */
  all_failed: boolean;
  /** Solo los que fallaron, con el motivo textual de Correo. */
  failures: Array<{ tracking_number: string; error: string }>;
}

/** Mensaje cuando Correo contesta el ítem sin PDF y sin motivo. */
export const CORREO_MISSING_LABEL_MESSAGE = 'Correo no devolvió el rótulo';

/**
 * Resume un lote de rótulos SIN colapsarlo a un solo éxito/fracaso.
 *
 * ⚠️ `POST /labels` de Correo es bulk nativo y devuelve las fallas parciales con
 * **HTTP 200** y `result: "ERROR: ..."` en el ítem. Si la UI mostrara un solo
 * "listo" porque la llamada HTTP no tiró, el operador se lleva 8 rótulos de 10 y
 * ninguna pista de cuáles faltan; al revés (un "falló" global) le esconde los 8
 * que sí salieron. Las dos cosas son mentiras: el estado real es por ítem.
 *
 * Un ítem `ok: true` SIN archivo cuenta como FALLA: "OK" sin PDF no es un
 * rótulo, y darlo por bueno produce un archivo vacío que se descubre recién en la
 * impresora.
 */
export function summarizeCorreoLabels(
  labels: ReadonlyArray<CorreoLabelLike>
): CorreoLabelSummary {
  const failures: Array<{ tracking_number: string; error: string }> = [];

  for (const label of labels) {
    if (label.ok && correoLabelHasFile(label)) continue;
    failures.push({
      tracking_number: label.tracking_number,
      error: label.error ?? CORREO_MISSING_LABEL_MESSAGE,
    });
  }

  const total = labels.length;
  const error_count = failures.length;

  return {
    total,
    ok_count: total - error_count,
    error_count,
    all_ok: total > 0 && error_count === 0,
    all_failed: total > 0 && error_count === total,
    failures,
  };
}

/**
 * base64 → bytes, para armar el `Blob` del PDF en el browser.
 *
 * Tolera el data-URL y el whitespace que mete un JSON pretty-printed; devuelve
 * un array vacío para entrada inválida en vez de tirar, porque un rótulo roto no
 * puede tumbar el render del lote entero.
 */
export function base64ToBytes(base64: unknown): Uint8Array {
  if (typeof base64 !== 'string') return new Uint8Array(0);
  const cleaned = base64
    .replace(/^data:[^;]*;base64,/, '')
    .replace(/\s+/g, '');
  if (cleaned.length === 0) return new Uint8Array(0);

  try {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return new Uint8Array(0);
  }
}

// ─── Colores de estado ───────────────────────────────────────────────────────

export type CorreoStatusColor = 'green' | 'blue' | 'orange' | 'red' | 'grey';

/**
 * Bucket del normalizador de tracking → color del `StatusBadge`.
 *
 * `unknown` es GRIS y no rojo a propósito: la tabla de `statusId` de Correo no
 * está publicada, así que "no supimos mapear este código" es lo normal y no un
 * problema del envío. Pintarlo de rojo entrenaría al operador a ignorar rojos.
 */
export function correoBucketColor(bucket: unknown): CorreoStatusColor {
  switch (String(bucket)) {
    case 'delivered':
      return 'green';
    case 'in_transit':
    case 'out_for_delivery':
    case 'admitted':
      return 'blue';
    case 'pre_shipment':
      return 'orange';
    case 'failed':
    case 'returned':
    case 'canceled':
      return 'red';
    default:
      return 'grey';
  }
}

// ─── Health check ────────────────────────────────────────────────────────────

/**
 * Estados de la sonda de `GET /admin/correo-argentino/health`.
 * Espeja `CorreoProbeStatus` + `CorreoMiCorreoProbeStatus` de
 * `src/api/admin/correo-argentino/health/_probe.ts`.
 */
export type CorreoHealthStatus =
  | 'no_probado'
  | 'sin_credenciales'
  | 'ok'
  | 'credenciales_invalidas'
  | 'gateway_inalcanzable'
  | 'error_desconocido'
  | 'cuenta_no_activada'
  | 'sin_tarifas';

/**
 * Estado de la sonda → color del `StatusBadge`.
 *
 * ⚠️ `cuenta_no_activada` es **ROJO**, no naranja, y es la decisión más
 * importante de este mapeo. Técnicamente "autentica bien", así que la tentación
 * es pintarlo de warning tibio — pero significa que MiCorreo devuelve la
 * cotización vacía, o sea que el checkout le muestra "Gratuito" al comprador en
 * cada venta y el flete lo paga el comercio (decisión D4). Es plata perdida por
 * venta, no una advertencia.
 *
 * `gateway_inalcanzable` y `sin_tarifas` sí son naranjas: el primero se arregla
 * solo, el segundo puede ser el par de CPs de la sonda y no la cuenta.
 */
export function correoHealthColor(status: unknown): CorreoStatusColor {
  switch (String(status)) {
    case 'ok':
      return 'green';
    case 'credenciales_invalidas':
    case 'cuenta_no_activada':
    case 'error_desconocido':
      return 'red';
    case 'sin_credenciales':
    case 'gateway_inalcanzable':
    case 'sin_tarifas':
      return 'orange';
    default:
      // `no_probado` incluido: "no lo probamos" no es ni bueno ni malo.
      return 'grey';
  }
}

/**
 * ¿La sonda encontró algo que requiere acción humana AHORA?
 *
 * `no_probado` y `gateway_inalcanzable` no cuentan: el primero no averiguó nada
 * y el segundo se puede arreglar reintentando. Lo demás (credenciales mal,
 * cuenta sin activar, error desconocido) necesita que alguien haga algo.
 */
export function correoHealthNeedsAction(status: unknown): boolean {
  return (
    correoHealthColor(status) === 'red' || String(status) === 'sin_credenciales'
  );
}

/** Clave de i18n del estado de la sonda. */
export function correoHealthLabelKey(status: unknown): string {
  const known: CorreoHealthStatus[] = [
    'no_probado',
    'sin_credenciales',
    'ok',
    'credenciales_invalidas',
    'gateway_inalcanzable',
    'error_desconocido',
    'cuenta_no_activada',
    'sin_tarifas',
  ];
  const value = String(status) as CorreoHealthStatus;
  return known.includes(value)
    ? `HEALTH_STATUS_${value.toUpperCase()}`
    : 'HEALTH_STATUS_ERROR_DESCONOCIDO';
}

/** Fila del reporte de configuración. Espeja `CorreoSettingStatus` del backend. */
export interface CorreoEnvVarLike {
  name: string;
  /**
   * Hay valor efectivo. Se llamaba `present` cuando la única fuente posible era el
   * `.env`; hoy el valor puede venir de la fila de la tienda, de la global, de una
   * credencial o del default, y "existe la env var" ya no responde nada.
   */
  configured: boolean;
  usable: boolean;
  requirement: string;
  group: string;
}

/**
 * Estado visible de una clave.
 *
 * `invalida` es el caso que un semáforo de dos colores esconde: la clave SÍ tiene
 * valor y el módulo lo descarta igual (una API-Key que es solo el prefijo
 * `"Apikey"`, un extClient que no son 3 dígitos). Mostrarla como "cargada" sería
 * mentir; como "sin cargar", mandar a cargar algo que ya está.
 *
 * El ORIGEN es ortogonal a esto y se muestra aparte: un valor puede estar en verde
 * y venir de la global, que es información distinta —y a veces la que importa—
 * cuando la pregunta es "por qué en la tienda B anda distinto".
 */
export type CorreoEnvVarState = 'ok' | 'invalida' | 'ausente';

export function correoEnvVarState(entry: CorreoEnvVarLike): CorreoEnvVarState {
  if (entry.usable) return 'ok';
  return entry.configured ? 'invalida' : 'ausente';
}

export function correoEnvVarColor(entry: CorreoEnvVarLike): CorreoStatusColor {
  const state = correoEnvVarState(entry);
  if (state === 'ok') return 'green';
  if (state === 'invalida') return 'red';
  // Una opcional que falta no es un problema: tiene default.
  return entry.requirement === 'opcional' ? 'grey' : 'red';
}

/** Status nativo del fulfillment de Medusa → color del `StatusBadge`. */
export function correoFulfillmentStatusColor(status: unknown): CorreoStatusColor {
  switch (String(status).toLowerCase()) {
    case 'delivered':
    case 'entregado':
      return 'green';
    case 'shipped':
    case 'in_transit':
      return 'blue';
    case 'pending':
    case 'not_fulfilled':
      return 'orange';
    case 'canceled':
    case 'cancelled':
    case 'failed':
      return 'red';
    default:
      return 'grey';
  }
}
