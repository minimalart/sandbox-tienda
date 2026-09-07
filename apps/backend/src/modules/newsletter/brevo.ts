import type { NewsletterSettings } from './settings';

/**
 * Cliente de contactos de Brevo. Una sola operación: alta idempotente en una lista.
 *
 * ─── EL RESULTADO TIENE TRES ESTADOS, NO DOS ────────────────────────────────
 *
 * `skipped` no es un sabor de `failed`, y la distinción es la que este ticket
 * necesitaba: un `failed` invita a reintentar y un `skipped` dice que reintentar
 * no puede servir porque no hay credenciales que usar. Colapsarlos deja al
 * operador apretando "Reintentar" contra una tienda que nunca cargó la API key.
 *
 * ─── POR QUÉ NO HAY REINTENTO AUTOMÁTICO ACÁ ────────────────────────────────
 *
 * Esta llamada está en el camino del request del visitante. Un reintento con
 * backoff le agregaría segundos a un formulario cuyo resultado NO depende de que
 * Brevo conteste: la fila ya está escrita antes de llamar. El reintento correcto
 * es el manual desde la pantalla de Suscriptores, o un backfill; no hacerlo
 * esperar a él.
 *
 * Tampoco cuelga de un evento: en este backend el event bus corre con
 * concurrency 1, así que un subscriber lento tapa la cola de notificaciones
 * entera. Una llamada acotada por timeout es más barata que ese riesgo.
 */

export type BrevoSyncResult =
  | { status: 'synced'; listId: number }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string };

/** Brevo suele contestar en menos de 500 ms; 8 s es techo, no expectativa. */
const REQUEST_TIMEOUT_MS = 8_000;

export type BrevoContactInput = {
  email: string;
  /** Se mandan como `attributes`. Vacío es válido: Brevo sólo exige el mail. */
  attributes?: Record<string, unknown>;
};

type FetchLike = typeof globalThis.fetch;

/**
 * Da de alta (o actualiza) el contacto y lo agrega a la lista configurada.
 *
 * `updateEnabled: true` es lo que lo hace idempotente y lo que resuelve el caso
 * más común de todos: el visitante que ya está en Brevo por otra vía. Sin esa
 * bandera, Brevo responde 400 `duplicate_parameter` y el contacto NUNCA entra a
 * la lista — se vería como un error de integración cuando en realidad es la
 * llamada la que está mal formada.
 */
export async function syncContactToBrevo(
  settings: NewsletterSettings,
  input: BrevoContactInput,
  deps: { fetch?: FetchLike } = {},
): Promise<BrevoSyncResult> {
  if (!settings.enabled) {
    return { status: 'skipped', reason: 'La sincronización con Brevo está apagada en Ajustes.' };
  }
  if (!settings.apiKey) {
    return { status: 'skipped', reason: 'Falta la API key de Brevo para esta tienda.' };
  }
  if (settings.listId === null) {
    return { status: 'skipped', reason: 'Falta el ID de la lista de Brevo para esta tienda.' };
  }

  const doFetch = deps.fetch ?? globalThis.fetch;
  const url = `${settings.apiUrl.replace(/\/+$/, '')}/contacts`;

  let response: Response;
  try {
    response = await doFetch(url, {
      method: 'POST',
      headers: {
        'api-key': settings.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        email: input.email,
        listIds: [settings.listId],
        updateEnabled: true,
        ...(input.attributes && Object.keys(input.attributes).length > 0
          ? { attributes: input.attributes }
          : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = (error as Error)?.name === 'TimeoutError'
      ? `Brevo no respondió en ${REQUEST_TIMEOUT_MS / 1000} s.`
      : `No se pudo conectar con Brevo: ${(error as Error).message}`;
    return { status: 'failed', error: message };
  }

  // 201 = contacto creado. 204 = ya existía y se actualizó (updateEnabled).
  if (response.ok) return { status: 'synced', listId: settings.listId };

  return { status: 'failed', error: await describeError(response) };
}

/**
 * El mensaje que va a `sync_error` y termina en la pantalla del admin.
 *
 * Se prioriza el `code` de Brevo sobre el status HTTP porque es lo accionable:
 * `unauthorized` manda a revisar la key y `invalid_parameter` sobre `listIds`
 * manda a revisar el número de lista. Un "HTTP 400" pelado no distingue las dos.
 */
async function describeError(response: Response): Promise<string> {
  let payload: { code?: string; message?: string } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // Brevo devolvió algo que no es JSON (un 502 de su borde, por ejemplo).
  }
  const detail = [payload.code, payload.message].filter(Boolean).join(': ');
  return detail ? `Brevo ${response.status}: ${detail}` : `Brevo respondió HTTP ${response.status}.`;
}
