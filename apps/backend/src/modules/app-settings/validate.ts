import type { SettingDescriptor } from './descriptors/types';

/**
 * Coerción y validación de valores contra su descriptor.
 *
 * Todo acá es PURO y sin dependencias: es lo único que los tests de este repo
 * pueden cubrir (`node:test`, sin DB — ver `apps/backend/package.json:16`), así
 * que toda decisión de forma vive en estas funciones y no en `service.ts`.
 *
 * No se usa zod a propósito. La UI necesita `min`/`max`/`options`/`pattern` como
 * DATOS para dibujar el input; construir un `ZodType` y después intentar
 * extraerle esos campos de vuelta es frágil. El mismo descriptor declarativo
 * alimenta el render y esta validación. zod se sigue usando en el borde HTTP,
 * para la forma del sobre (`{namespace, values, unset}`), que es lo que hace
 * bien.
 */

export type CoerceOk = { ok: true; value: unknown };
export type CoerceErr = { ok: false; error: string };
export type CoerceResult = CoerceOk | CoerceErr;

const ok = (value: unknown): CoerceOk => ({ ok: true, value });
const err = (error: string): CoerceErr => ({ ok: false, error });

/**
 * Un input de secreto vacío significa "no toqué el campo enmascarado", NUNCA
 * "borralo". Borrar es explícito, por `unset[]`.
 *
 * Sin esta regla, abrir la card de una extensión y guardar cualquier otro campo
 * borraría todas sus credenciales — que es exactamente el bug que
 * `erp/service.ts:255-259` documenta haber pagado.
 */
export function isUntouchedSecret(descriptor: SettingDescriptor, raw: unknown): boolean {
  return descriptor.type === 'secret' && (raw === '' || raw === null || raw === undefined);
}

/** Valida y normaliza un valor entrante contra su descriptor. */
export function coerceAndValidate(descriptor: SettingDescriptor, raw: unknown): CoerceResult {
  const base = coerceByType(descriptor, raw);
  if (!base.ok) return base;

  if (descriptor.refine) {
    const problem = descriptor.refine(base.value);
    if (problem) return err(problem);
  }
  return base;
}

function coerceByType(d: SettingDescriptor, raw: unknown): CoerceResult {
  switch (d.type) {
    case 'string':
    case 'text':
      return coerceString(d, raw);
    case 'url':
      return coerceUrl(d, raw);
    case 'secret':
      return coerceSecret(raw);
    case 'number':
      return coerceNumber(d, raw);
    case 'boolean':
      return coerceBoolean(raw);
    case 'enum':
      return coerceEnum(d, raw);
    case 'json':
      return coerceJson(raw);
    default: {
      // Exhaustividad: si se agrega un tipo al union y no se maneja acá, TS lo
      // marca en compilación en vez de dejarlo pasar en runtime.
      const never: never = d.type;
      return err(`Tipo de setting no soportado: ${String(never)}`);
    }
  }
}

function coerceString(d: SettingDescriptor, raw: unknown): CoerceResult {
  if (typeof raw !== 'string') return err('Tiene que ser texto.');
  const value = raw.trim();
  if (value === '') return err('No puede estar vacío. Para volver al valor heredado, usá "Restaurar".');
  if (d.maxLength !== undefined && value.length > d.maxLength) {
    return err(`No puede superar ${d.maxLength} caracteres.`);
  }
  if (d.pattern !== undefined && !new RegExp(d.pattern).test(value)) {
    return err('El formato no es válido.');
  }
  return ok(value);
}

function coerceUrl(d: SettingDescriptor, raw: unknown): CoerceResult {
  const asString = coerceString({ ...d, type: 'string' }, raw);
  if (!asString.ok) return asString;
  const value = asString.value as string;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return err('Tiene que ser una URL absoluta (con http:// o https://).');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return err('Sólo se aceptan URLs http o https.');
  }
  return ok(value);
}

function coerceSecret(raw: unknown): CoerceResult {
  if (typeof raw !== 'string') return err('Tiene que ser texto.');
  // Sin trim: hay secretos que legítimamente terminan en '=' o llevan espacios
  // internos, y recortarlos en silencio produce un 401 imposible de diagnosticar.
  if (raw === '') return err('No puede estar vacío. Para borrarlo, usá "Borrar".');
  return ok(raw);
}

function coerceNumber(d: SettingDescriptor, raw: unknown): CoerceResult {
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? '').trim());
  if (!Number.isFinite(n)) return err('Tiene que ser un número.');
  if (d.min !== undefined && n < d.min) return err(`No puede ser menor que ${d.min}.`);
  if (d.max !== undefined && n > d.max) return err(`No puede ser mayor que ${d.max}.`);
  return ok(n);
}

function coerceBoolean(raw: unknown): CoerceResult {
  if (typeof raw === 'boolean') return ok(raw);
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'true' || s === '1') return ok(true);
  if (s === 'false' || s === '0') return ok(false);
  return err('Tiene que ser verdadero o falso.');
}

function coerceEnum(d: SettingDescriptor, raw: unknown): CoerceResult {
  if (typeof raw !== 'string') return err('Tiene que ser texto.');
  const value = raw.trim();
  const allowed = (d.options ?? []).map((o) => o.value);
  if (!allowed.includes(value)) {
    return err(`Tiene que ser uno de: ${allowed.join(', ')}.`);
  }
  return ok(value);
}

function coerceJson(raw: unknown): CoerceResult {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return err('No puede estar vacío.');
    try {
      return ok(JSON.parse(trimmed));
    } catch {
      return err('JSON inválido.');
    }
  }
  if (raw === null || raw === undefined) return err('No puede estar vacío.');
  if (typeof raw === 'object') return ok(raw);
  return err('Tiene que ser un objeto o un array JSON.');
}

/**
 * Interpreta el valor crudo de una env var (siempre string) según el tipo del
 * descriptor. Devuelve `undefined` si la variable no está definida o quedó
 * vacía — así "definida en blanco" y "no definida" son lo mismo, que es lo que
 * pasa en la práctica cuando un panel de deploy tiene la fila creada sin valor.
 *
 * A diferencia de `coerceAndValidate`, esto NO valida rangos ni patrones: un env
 * fuera de rango tiene que seguir funcionando como funcionaba antes de esta
 * migración. Sólo se convierte el tipo.
 */
export function coerceFromEnv(
  descriptor: SettingDescriptor,
  read: (name: string) => string | undefined,
): unknown | undefined {
  for (const name of descriptor.env) {
    const raw = read(name);
    if (raw === undefined || raw.trim() === '') continue;

    switch (descriptor.type) {
      case 'number': {
        const n = Number.parseFloat(raw.trim());
        if (Number.isFinite(n)) return n;
        continue;
      }
      case 'boolean':
        return raw.trim().toLowerCase() === 'true' || raw.trim() === '1';
      case 'json':
        try {
          return JSON.parse(raw);
        } catch {
          continue;
        }
      case 'secret':
        return raw;
      default:
        return raw.trim();
    }
  }
  return undefined;
}
