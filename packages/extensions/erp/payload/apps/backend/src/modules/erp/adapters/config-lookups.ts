/**
 * Listados de opciones válidas para la CONFIGURACIÓN del ERP.
 *
 * ─── El problema ─────────────────────────────────────────────────────────────
 *
 * `ErpZeusSettings` tiene trece campos que hay que completar para que una venta
 * se facture, y seis de ellos son un código que sólo existe en la cuenta del
 * ERP: `sucursal` sale de `/sucursales`, `deposito_id` de `/depositos`,
 * `cond_venta` de `/condiciones-ventas`, `codigo_de_vendedor` de `/vendedores`,
 * `default_codigo_iva` de `/categorias-iva` y `tarjeta_code` de `/tarjetas`.
 * El docblock de cada campo lo dice desde el primer día.
 *
 * Pero **nadie llamaba esos endpoints**: en la pantalla de configuración los
 * trece son un `<Input>` de texto libre, sin una sola pista de qué valor va. La
 * configuración es obligatoria para facturar y la pantalla no ayuda a
 * completarla, así que en la práctica se completa preguntándole al cliente
 * códigos que el ERP ya sabe listar.
 *
 * ─── Por qué el normalizador es tolerante ────────────────────────────────────
 *
 * Los seis endpoints existen (sondeados: devuelven 401, no 404) pero **el
 * nombre de sus campos no está verificado** — hacen falta credenciales para
 * verlos, y la API de Zeus ya demostró divergir de su documentación (el query
 * param `eshop` está documentado y la API lo ignora, ver `ErpZeusSettings`).
 *
 * Así que no se asume un shape: se prueban los nombres candidatos habituales y
 * **cada opción conserva su fila cruda en `raw`**. Si el normalizador no acierta
 * la etiqueta, el operador igual ve el código y puede mirar `raw`; lo que no
 * pasa es que la pantalla quede vacía porque un campo se llamaba distinto.
 *
 * La primera corrida contra la cuenta real es la verificación: si alguna etiqueta
 * sale igual al valor, el nombre real del campo no está en `LABEL_KEYS` y hay que
 * sumarlo acá — no en el adapter.
 */

/** Los seis listados que alimentan campos de la config. El orden es el de la pantalla. */
export const ERP_CONFIG_LOOKUP_KINDS = [
  'sucursales',
  'depositos',
  'condiciones-ventas',
  'vendedores',
  'categorias-iva',
  'tarjetas',
] as const;

export type ErpConfigLookupKind = (typeof ERP_CONFIG_LOOKUP_KINDS)[number];

/** Qué campo de la config completa cada listado. Es lo que la UI usa para ubicar el selector. */
export const ERP_CONFIG_LOOKUP_TARGETS: Record<ErpConfigLookupKind, string> = {
  sucursales: 'sucursal',
  depositos: 'deposito_id',
  'condiciones-ventas': 'cond_venta',
  vendedores: 'codigo_de_vendedor',
  'categorias-iva': 'default_codigo_iva',
  tarjetas: 'tarjeta_code',
};

export type ErpConfigLookupOption = {
  /** El código que se guarda en la config. */
  value: string;
  /** Texto para mostrar. Cae al propio `value` si ninguna clave candidata aparece. */
  label: string;
  /** La fila tal como la devolvió el ERP, para poder diagnosticar sin volver a llamar. */
  raw: Record<string, unknown>;
};

export type ErpConfigLookups = {
  options: Partial<Record<ErpConfigLookupKind, ErpConfigLookupOption[]>>;
  /**
   * Por qué falló un listado, por listado. Un listado que falla NO invalida a
   * los otros cinco: la pantalla degrada campo por campo a texto libre, que es
   * exactamente lo que hay hoy.
   */
  errors: Partial<Record<ErpConfigLookupKind, string>>;
};

/**
 * Claves candidatas para el CÓDIGO, en orden de preferencia.
 *
 * `codigo` primero porque es el nombre que usa el resto de la API de Zeus
 * (`ClienteRow.codigo`, y los propios settings hablan de "código de /sucursales").
 * `id` va después a propósito: si una fila trae las dos, el código de negocio le
 * gana al id interno — guardar el id interno en `settings.zeus` produciría un
 * pedido que Zeus rechaza sin explicar por qué.
 */
const VALUE_KEYS = ['codigo', 'code', 'numero', 'nro', 'valor', 'id'] as const;

/** Claves candidatas para la ETIQUETA, en orden de preferencia. */
const LABEL_KEYS = [
  'descripcion',
  'detalle',
  'nombre',
  'denominacion',
  'razon_social',
  'titulo',
  'name',
  'label',
] as const;

/**
 * Índice de la fila por clave en minúscula y sin separadores.
 *
 * Zeus mezcla estilos entre endpoints (`razon_social` en clientes,
 * `puntoDeVenta` en comprobantes), así que comparar el nombre literal fallaría
 * en la mitad de los casos. `razon_social`, `razonSocial` y `RazonSocial` tienen
 * que resolver a la misma clave.
 */
const indexRow = (row: Record<string, unknown>): Map<string, unknown> => {
  const index = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    const flat = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    // La PRIMERA gana: `Object.entries` respeta el orden de inserción, así que
    // ante `codigo` y `Codigo` queda la que el ERP puso antes.
    if (!index.has(flat)) index.set(flat, value);
  }
  return index;
};

const flatten = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Primer valor no vacío entre las claves candidatas.
 *
 * `0` y `false` cuentan como presentes: una categoría de IVA o un depósito
 * pueden ser legítimamente el código `0`, y descartarlo con un `||` los borraría
 * de la lista. Sólo se saltean `null`, `undefined` y la cadena vacía.
 */
const pick = (index: Map<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = index.get(flatten(key));
    if (value === null || value === undefined) continue;
    if (typeof value === 'object') continue;
    const text = String(value).trim();
    if (text.length > 0) return text;
  }
  return null;
};

/**
 * Convierte la respuesta cruda de un listado en opciones.
 *
 * Descarta las filas sin código (no se puede guardar una opción sin valor) y las
 * marcadas como inactivas — mismo criterio que `searchClient` en el adapter de
 * Zeus, que ya saltea `activo === false`. Deduplica por `value` conservando la
 * primera aparición.
 */
export function normalizeLookupRows(rows: unknown): ErpConfigLookupOption[] {
  if (!Array.isArray(rows)) return [];
  const out: ErpConfigLookupOption[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    const index = indexRow(record);

    if (index.get('activo') === false) continue;

    const value = pick(index, VALUE_KEYS);
    if (!value || seen.has(value)) continue;
    seen.add(value);

    const label = pick(index, LABEL_KEYS);
    out.push({
      value,
      // Sin etiqueta, el código solo es más útil que un string vacío: al menos
      // se puede elegir. Y es la señal de que falta un nombre en LABEL_KEYS.
      label: label ? `${value} — ${label}` : value,
      raw: record,
    });
  }

  return out;
}
