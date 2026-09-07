/**
 * Configuración efectiva de carritos abandonados en el plugin.
 *
 * La precedencia es **snapshot > env > default**, IGUAL que la extensión
 * original. La diferencia es que el snapshot vive en el host (`app-settings`)
 * y el plugin no lo puede importar directamente. La coordinación pasa por
 * `@minimalart/mercatto-plugin-runtime`: el host registra su `resolveSettingSync`
 * envuelto una sola vez al arrancar, y este archivo lo lee vía `getAppSettingsSyncReader`.
 *
 * Cuando el host no registró un reader —proyecto sin `app-settings`, tests,
 * boot antes del bridge— se cae a `process.env`. Es la MISMA semántica que la
 * extensión original tenía "antes de que el loader llene el snapshot".
 */

import { getAppSettingsSyncReader } from '@minimalart/mercatto-plugin-runtime';

/**
 * TUPLA de tres y no `number[]`: `config.ts` desestructura los tres pasos sin
 * `?? default` por posición, evitando que `noUncheckedIndexedAccess` obligue a
 * repetir defaults como tercera copia.
 */
export type StepHours = readonly [number, number, number];

export type AbandonedCartSettings = {
  enabled: boolean;
  /** Horas de inactividad de cada paso, YA ordenadas. Ver `orderedStepHours`. */
  stepHours: StepHours;
  maxAgeHours: number;
  batchSize: number;
  maxPages: number;
};

const NAMESPACE = 'extension:abandoned-cart';

function readFromSnapshot(key: string): unknown {
  const reader = getAppSettingsSyncReader();
  if (!reader) return undefined;
  try {
    return reader(NAMESPACE, key);
  } catch {
    // Un reader que tira NO tiene que romper el barrido: se cae al env.
    // El host puede estar refrescando el snapshot, o el descriptor puede haber
    // cambiado entre versiones — cualquiera de esos casos vuelve a env.
    return undefined;
  }
}

function readEnvBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === '') return fallback;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
}

function readBool(key: string, fallback: boolean): boolean {
  const fromSnapshot = readFromSnapshot(key);
  if (typeof fromSnapshot === 'boolean') return fromSnapshot;
  return readEnvBool(key, fallback);
}

/**
 * Igual que `readEnvNumber`, pero exige un número POSITIVO.
 *
 * Sin este guard, un `ABANDONED_CART_BATCH_SIZE=0` heredado apagaría el barrido
 * sin un solo error: la paginación iría de a cero carritos por página, para
 * siempre y en silencio.
 */
function readPositive(key: string, fallback: number): number {
  const fromSnapshot = readFromSnapshot(key);
  if (fromSnapshot !== undefined && fromSnapshot !== null) {
    const num = Number(fromSnapshot);
    if (Number.isFinite(num) && num > 0) return num;
  }
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Fuerza que la secuencia sea NO DECRECIENTE, arrastrando cada paso hasta el
 * anterior si viene antes.
 *
 * Por qué CLAMP y no `sort()`: los pasos no son intercambiables. El 2 es el
 * único que manda WhatsApp y el 3 es el del incentivo, así que ordenar los
 * VALORES reasigna el contenido a otro momento — alguien que puso el paso 2 en
 * 2h por error terminaría mandando el mail del descuento antes que el primer
 * recordatorio. El clamp sólo DEMORA: nunca cambia qué mail va en qué posición.
 */
function clampUp(floor: number, value: number): number {
  const hours = Number.isFinite(value) && value > 0 ? value : floor;
  return Math.max(hours, floor);
}

export function orderedStepHours(raw: number[]): number[] {
  const out: number[] = [];
  let floor = 0;
  for (const value of raw) {
    floor = clampUp(floor, value);
    out.push(floor);
  }
  return out;
}

export function getAbandonedCartSettings(): AbandonedCartSettings {
  const step1 = readPositive('ABANDONED_CART_STEP1_HOURS', 1);
  const step2 = clampUp(step1, readPositive('ABANDONED_CART_STEP2_HOURS', 24));
  const step3 = clampUp(step2, readPositive('ABANDONED_CART_STEP3_HOURS', 72));

  return {
    enabled: readBool('ABANDONED_CART_ENABLED', true),
    stepHours: [step1, step2, step3],
    maxAgeHours: readPositive('ABANDONED_CART_MAX_AGE_HOURS', 24 * 14),
    batchSize: readPositive('ABANDONED_CART_BATCH_SIZE', 100),
    maxPages: readPositive('ABANDONED_CART_MAX_PAGES', 20),
  };
}
