/**
 * Helpers puros para procesar el resultado de una tool del MCP antes de
 * reinyectarlo al modelo como mensaje `tool`. Son funciones sin dependencias
 * (no tocan el MCP ni la DB) para poder testearlas en aislamiento.
 */

/** Tope duro del resultado de una tool que se reinyecta al modelo (en chars). */
export const MAX_TOOL_RESULT_CHARS = 60_000;

/**
 * Compacta el JSON que devuelven las tools del MCP antes de reinyectarlo como
 * mensaje `tool`. Los payloads de Medusa son enormes y redundantes para análisis:
 * cada monto viene duplicado en un gemelo `raw_*` (`{value, precision}`), cada
 * line item se repite entero dentro de `detail`, y las descripciones de producto
 * son párrafos largos. Listar 50 órdenes ⇒ ~145K tokens, lo que hacía el turno
 * lentísimo y caro. Sacar ese ruido reduce ~75% sin perder lo que importa para
 * responder (montos, cantidades, estados, fechas). Además se minifica.
 */
export function compactJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compactJson);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith('raw_')) continue; // gemelo redundante de cada monto
      if (k === 'detail') continue; // duplica el line item entero
      if (typeof v === 'string' && v.length > 200) {
        out[k] = `${v.slice(0, 200)}…`;
        continue;
      }
      out[k] = compactJson(v);
    }
    return out;
  }
  return value;
}

/**
 * ¿El resultado de una tool está "vacío"? Cubre las formas típicas de la Admin API
 * de Medusa: un array vacío, `{ count: 0 }`, o un objeto cuyas propiedades-lista
 * (`products`, `orders`, `customers`, …) vienen todas vacías. Sirve para darle al
 * modelo una señal explícita de "0 resultados" y que se auto-corrija (otra query /
 * otro filtro) en vez de afirmar que algo no existe.
 */
export function isEmptyResult(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.count === 'number' && obj.count === 0) return true;
    const arrays = Object.values(obj).filter(Array.isArray) as unknown[][];
    if (arrays.length > 0 && arrays.every((a) => a.length === 0)) return true;
  }
  return false;
}

/**
 * Señal de auto-corrección que se anexa a un resultado vacío. El modelo, dentro de
 * los `MAX_STEPS`, debe reintentar con OTRA variante (no la misma llamada) antes de
 * concluir que no hay datos. enthusiast lo llama "no-results retry".
 */
export const EMPTY_RESULT_HINT =
  ' [0 resultados. No afirmes que no existe: reintentá con OTRA variante (sin filtro de fecha, otro estado/segmento, "order":"-created_at" y acotá después). No repitas esta misma llamada idéntica.]';

export function compactToolResult(text: string, toolName = ''): string {
  // External MCP payloads are not Medusa entities: raw_content is page text,
  // detail can explain an error, and long strings can be the requested document.
  const external = toolName.startsWith('mcp__');
  let out = text;
  let empty = false;
  try {
    const value = JSON.parse(text);
    const parsed = external ? value : compactJson(value);
    empty = !external && isEmptyResult(parsed);
    out = JSON.stringify(parsed);
    if (external && parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.error) {
      out = `Error de herramienta MCP: ${out}`;
    }
  } catch {
    // No era JSON (p. ej. un mensaje de error): se deja tal cual.
  }
  if (out.length > MAX_TOOL_RESULT_CHARS) {
    return `${out.slice(0, MAX_TOOL_RESULT_CHARS)}…[resultado truncado: pedí menos registros (limit) o más específico]`;
  }
  return empty ? out + EMPTY_RESULT_HINT : out;
}
