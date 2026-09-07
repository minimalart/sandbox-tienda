import { z } from 'zod';

/**
 * Análisis de los ENVÍOS REALES de una plantilla: qué valor tuvo cada variable en
 * el mail que efectivamente salió.
 *
 * ¿Por qué existe? Porque la pantalla de la plantilla sólo tenía `sample_data`, que
 * son valores de DEMO escritos a mano para la vista previa. Un mail podía salir con
 * una variable que NADIE poblaba y la UI seguía mostrando el valor lindo del
 * ejemplo. Eso ya pasó: `sales_channel_name` está declarada en `password-reset` y el
 * emisor real nunca la manda, así que Handlebars la renderizaba como `''` y los
 * asuntos salieron `[] Restablecer tu contraseña` durante semanas — sin una línea en
 * el log y sin nada en el backoffice. Medido contra la base de desdeelsur el
 * 02/09: 8 de 8 envíos de `password-reset` NO tienen la clave `sales_channel_name`
 * en su payload, y tampoco `subject`.
 *
 * La fuente de verdad no hay que construirla: `notification.data` YA guarda el
 * payload exacto de cada envío. Este módulo sólo lo cruza contra las variables
 * declaradas y clasifica la diferencia.
 *
 * Es DATA PURA a propósito (sin imports de `@medusajs`), igual que
 * `modules/email/template-variables.ts`: así se puede testear sin bootear el
 * backend, que es la única forma de tener tests en este repo.
 */

// ─── Query ────────────────────────────────────────────────────────────────────

export const SENDS_DEFAULT_LIMIT = 10;

/**
 * El tope no es una preferencia estética: `data` de un `order-confirmation` trae el
 * array completo de items y las dos direcciones, y esta respuesta viaja entera al
 * bundle del admin. Cincuenta envíos ya son un JSON de cientos de KB para una
 * pantalla de diagnóstico donde el operador mira los últimos tres.
 */
export const SENDS_MAX_LIMIT = 50;

/**
 * `limit` inválido devuelve 400, NO se corrige en silencio.
 *
 * Tentación descartada: `.catch(SENDS_DEFAULT_LIMIT)`. Toda esta feature existe
 * porque el sistema aceptaba datos incompletos sin avisar; sería incoherente que su
 * propia ruta hiciera lo mismo con su único parámetro.
 */
export const GetAdminEmailTemplateSends = z.object({
  limit: z.coerce
    .number()
    .int('limit tiene que ser un entero')
    .min(1, 'limit tiene que ser al menos 1')
    .max(SENDS_MAX_LIMIT, `limit no puede pasar de ${SENDS_MAX_LIMIT}`)
    .default(SENDS_DEFAULT_LIMIT),
});

export type GetAdminEmailTemplateSendsInput = z.infer<
  typeof GetAdminEmailTemplateSends
>;

// ─── Estado de una variable ───────────────────────────────────────────────────

export type VariableState = 'ok' | 'empty' | 'missing';

/**
 * `missing` y `empty` NO son lo mismo, y separarlos es la mitad del valor de esta
 * pantalla.
 *
 *   missing  la clave no está en el payload. El emisor no la manda: el bug está en
 *            el subscriber, no en la plantilla. Es el caso `sales_channel_name`.
 *   empty    la clave está y vino vacía. El emisor la manda pero la fuente no tenía
 *            el dato: el bug está aguas arriba del subscriber.
 *
 * Handlebars renderiza las dos como `''`, o sea que en el mail se ven IDÉNTICAS.
 * Distinguirlas acá es lo que le dice al operador a quién reclamarle.
 *
 * `0` y `false` son `ok`, no `empty`. Un `!value` los daría por vacíos y esta
 * pantalla empezaría a mentir con `display_id: 0` o `makes_free: false` — que es
 * exactamente la familia de bugs del mail con `quantity 0`.
 *
 * El array y el objeto vacíos SÍ cuentan como `empty`: un `order_items: []` produce
 * un mail de confirmación sin ningún producto, que es un bug de los caros y el único
 * lugar donde se ve es acá.
 */
export function variableState(
  data: Record<string, unknown> | null | undefined,
  name: string,
): VariableState {
  if (!data || !Object.prototype.hasOwnProperty.call(data, name)) return 'missing';

  const value = data[name];
  if (value === null || value === undefined) return 'empty';
  if (typeof value === 'string' && value.trim() === '') return 'empty';
  if (Array.isArray(value)) return value.length === 0 ? 'empty' : 'ok';
  if (typeof value === 'object' && Object.keys(value as object).length === 0) {
    return 'empty';
  }
  return 'ok';
}

// ─── Enmascarado ──────────────────────────────────────────────────────────────

/**
 * DECISIÓN: el valor se MUESTRA, pero los tokens se truncan.
 *
 * `link_reseteo` de `password-reset` no es una URL cualquiera: verificado contra la
 * base de desdeelsur, sus 8 envíos llevan
 * `https://.../reset-password?token=eyJhbGciOiJIUzI1N…`, un JWT VIVO que toma la
 * cuenta del cliente. Publicarlo en el backoffice convierte "ver si la variable
 * tiene el valor correcto" en una escalada de privilegios: cualquiera con sesión de
 * admin —o cualquiera que reciba una captura de pantalla, o el HAR de un soporte—
 * se apropia de la cuenta sin la contraseña.
 *
 * Ocultar el valor entero tampoco sirve: la pregunta del operador es "¿apunta al
 * dominio correcto?" y "¿trae el token o vino sin él?". Truncar responde las dos y
 * no entrega la credencial. Se conserva a propósito el esquema, el host, el path y
 * el NOMBRE del parámetro; se corta el valor del parámetro.
 *
 * `to` NO se enmascara: el operador necesita saber a QUIÉN le salió el mail, y el
 * admin ya le muestra los emails de los clientes en pedidos y en clientes. Ocultarlo
 * acá no protegería nada y rompería el único uso de la pantalla.
 */
const KEEP_PREFIX = 8;

/** Parámetros de query cuyo VALOR es una credencial. */
const SECRET_PARAM =
  /^(token|access_token|refresh_token|reset_token|id_token|jwt|secret|signature|sig|api_key|apikey|password|passwd|otp|code)$/i;

/** Nombres de variable cuyo valor entero es una credencial, sin ser una URL. */
const SECRET_NAME =
  /(^|_)(token|secret|password|passwd|apikey|api_key|signature|jwt|otp|credential)(_|$)/i;

/** Hasta acá baja el recorrido de arrays y objetos anidados. */
const MAX_MASK_DEPTH = 4;

export function truncateSecret(raw: string): string {
  if (raw.length <= KEEP_PREFIX) return '••••';
  return `${raw.slice(0, KEEP_PREFIX)}…[${raw.length - KEEP_PREFIX} car. ocultos]`;
}

/**
 * Enmascara los parámetros sensibles de una query string embebida en un string.
 *
 * A propósito NO usa `new URL()`: la mitad de estos valores son URLs relativas
 * (`/reset-password?token=…`) y `new URL` las rechaza, lo que dejaría el token
 * intacto justo en el caso que hay que cubrir.
 */
function maskQueryParams(value: string): string {
  return value.replace(
    /([?&])([A-Za-z0-9_.\-[\]]+)=([^&#\s]+)/g,
    (whole, sep: string, param: string, raw: string) =>
      SECRET_PARAM.test(param) ? `${sep}${param}=${truncateSecret(raw)}` : whole,
  );
}

function maskString(name: string, value: string): string {
  const byParam = maskQueryParams(value);
  if (byParam !== value) return byParam;
  // Sin query string, el único indicio que queda es el nombre de la variable.
  if (SECRET_NAME.test(name)) return truncateSecret(value);
  return value;
}

/**
 * Recorre el valor enmascarando lo sensible. Devuelve `{ value, masked }` para que
 * la UI pueda avisar que lo que muestra está recortado — un valor truncado sin ese
 * aviso haría que el operador crea que el token real está mal formado.
 */
export function maskVariableValue(
  name: string,
  value: unknown,
  depth = MAX_MASK_DEPTH,
): { value: unknown; masked: boolean } {
  if (typeof value === 'string') {
    const next = maskString(name, value);
    return { value: next, masked: next !== value };
  }

  if (depth <= 0 || value === null || typeof value !== 'object') {
    return { value, masked: false };
  }

  let masked = false;

  if (Array.isArray(value)) {
    const out = value.map((item) => {
      // El nombre del padre se propaga: un array `tokens` lleva credenciales en
      // cada posición y sus items no tienen nombre propio del cual deducirlo.
      const res = maskVariableValue(name, item, depth - 1);
      masked = masked || res.masked;
      return res.value;
    });
    return { value: out, masked };
  }

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    const res = maskVariableValue(key, inner, depth - 1);
    masked = masked || res.masked;
    out[key] = res.value;
  }
  return { value: out, masked };
}

// ─── Análisis de un envío ─────────────────────────────────────────────────────

export type DeclaredVariable = { name: string; description?: string };

export type SendVariable = {
  name: string;
  description?: string;
  /** El valor REAL del payload, con los tokens truncados. `undefined` si `missing`. */
  value: unknown;
  state: VariableState;
  /** `true` cuando `value` se recortó por seguridad y no es el valor literal. */
  masked: boolean;
};

export type SendAnalysis = {
  id: string;
  to: string;
  created_at: string;
  status: string;
  provider_id: string;
  /** Las declaradas, en el orden en que las declara la plantilla. */
  variables: SendVariable[];
  /** Claves presentes en el payload que nadie declaró. */
  undeclared: SendVariable[];
  /** Para que la fila del listado se pinte sin recorrer los arrays. */
  counts: { ok: number; empty: number; missing: number; undeclared: number };
};

/**
 * Claves que el PROVEEDOR usa como canal interno, no variables de la plantilla.
 *
 * `__subject`/`__html` son la convención del `template: '__inline__'` que usa el
 * envío de prueba del admin: el asunto y el HTML ya renderizados. Aparecerían como
 * "claves no declaradas" y no lo son — son plomería. Hoy el listado ni los alcanza
 * (ver la nota de `__inline__` en la ruta), pero filtrarlos cuesta nada y evita que
 * la pantalla acuse un problema inventado, que es el defecto simétrico del que esta
 * feature vino a arreglar.
 */
const PROVIDER_INTERNAL_KEYS = new Set(['__subject', '__html']);

export function analyzeSend(
  notification: {
    id: string;
    to: string;
    created_at: Date | string;
    status: string;
    provider_id: string;
    data: Record<string, unknown> | null;
  },
  declared: DeclaredVariable[],
): SendAnalysis {
  const data = notification.data ?? {};
  const declaredNames = new Set(declared.map((v) => v.name));

  const counts = { ok: 0, empty: 0, missing: 0, undeclared: 0 };

  const variables: SendVariable[] = declared.map((decl) => {
    const state = variableState(data, decl.name);
    counts[state] += 1;

    // `missing` no lleva `value`: mandar `null` la volvería indistinguible de una
    // `empty` en el cliente, que es justo la distinción que la pantalla vende.
    if (state === 'missing') {
      return {
        name: decl.name,
        ...(decl.description ? { description: decl.description } : {}),
        value: undefined,
        state,
        masked: false,
      };
    }

    const { value, masked } = maskVariableValue(decl.name, data[decl.name]);
    return {
      name: decl.name,
      ...(decl.description ? { description: decl.description } : {}),
      value,
      state,
      masked,
    };
  });

  const undeclared: SendVariable[] = [];
  for (const key of Object.keys(data)) {
    if (declaredNames.has(key)) continue;
    if (PROVIDER_INTERNAL_KEYS.has(key)) continue;
    const { value, masked } = maskVariableValue(key, data[key]);
    undeclared.push({
      name: key,
      value,
      state: variableState(data, key),
      masked,
    });
  }
  counts.undeclared = undeclared.length;

  return {
    id: notification.id,
    to: notification.to,
    created_at:
      notification.created_at instanceof Date
        ? notification.created_at.toISOString()
        : String(notification.created_at),
    status: notification.status,
    provider_id: notification.provider_id,
    variables,
    undeclared,
    counts,
  };
}

// ─── Atribución por tienda ────────────────────────────────────────────────────

export type SiteAttribution = 'yes' | 'no' | 'unknown';

/**
 * ¿Este envío es de la tienda activa?
 *
 * `notification` NO tiene columna de tienda: el único eje posible está adentro de
 * `data`, y sólo cuando el emisor se acordó de ponerlo. Medido contra desdeelsur el
 * 02/09: `order-confirmation`, `order-notification-admin` y los tres
 * `cart-abandoned-*` traen `sales_channel_id`; `password-reset`, `customer-register`
 * y `admin-invite` NO traen NINGÚN marcador.
 *
 * Por eso el veredicto es de TRES valores y no booleano. `unknown` es un estado real
 * y frecuente, y colapsarlo a `no` (fail-closed a secas) escondería el 100% de los
 * envíos de `password-reset` — justo la plantilla por la que se pidió esta pantalla.
 * Colapsarlo a `yes` filtraría el mail de un cliente de otra tienda. La ruta decide
 * qué hacer con `unknown`; este helper no miente sobre lo que sabe.
 */
export function siteAttribution(
  data: Record<string, unknown> | null | undefined,
  site: { id: string; channel_ids: string[] },
): SiteAttribution {
  if (!data) return 'unknown';

  const siteId = data.site_id;
  if (typeof siteId === 'string' && siteId.length > 0) {
    return siteId === site.id ? 'yes' : 'no';
  }

  const channelId = data.sales_channel_id;
  if (typeof channelId === 'string' && channelId.length > 0) {
    return site.channel_ids.includes(channelId) ? 'yes' : 'no';
  }

  return 'unknown';
}
