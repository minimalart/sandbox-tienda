import { ErpAuthError, ErpConnectionError, ErpNonRetryableError } from './types';

/**
 * Cliente fino de JSON-RPC contra Odoo (`/jsonrpc`, service `object`, method
 * `execute_kw`). Stateless por llamada: sin cache, sin sesión.
 *
 * Auth: no se hace `common.login` — se usa el par `uid` + `api_key` que Odoo
 * emite desde `Preferences → Account Security`. El servidor acepta la API Key
 * en el lugar del password de `execute_kw`, así que el flujo es un solo POST.
 *
 * Errores: Odoo devuelve HTTP 200 con `{ error: { code, data: { name,
 * message, debug } } }` en el cuerpo también cuando algo falla, así que este
 * cliente NO puede decidir por status HTTP:
 * - `odoo.exceptions.AccessError` / `AccessDenied` → `ErpAuthError`.
 * - `ValidationError` u otros 4xx-equivalentes → `ErpNonRetryableError`.
 * - Timeout/fetch fail / 5xx → `ErpConnectionError`.
 */

export type OdooRpcConfig = {
  baseUrl: string;
  db: string;
  uid: number;
  apiKey: string;
  /**
   * IDs de compañías cuyo scope habilita esta llamada. Se manda en
   * `context.allowed_company_ids` para instalaciones multi-empresa; vacío/omit
   * hace que Odoo caiga a la compañía activa del usuario.
   */
  allowedCompanyIds?: number[];
  timeoutMs?: number;
};

/** Odoo es más rápido que Zeus (~30 s alcanza para el catálogo entero). */
const DEFAULT_TIMEOUT_MS = 30_000;

type OdooRpcError = {
  code?: number;
  message?: string;
  data?: {
    name?: string;
    message?: string;
    debug?: string;
    arguments?: unknown[];
  };
};

type OdooRpcResponse<T> = {
  jsonrpc?: string;
  id?: number | null;
  result?: T;
  error?: OdooRpcError;
};

/** Marcadores del error name que Odoo devuelve como AccessError/AccessDenied. */
const AUTH_ERROR_NAMES = [
  'odoo.exceptions.AccessError',
  'odoo.exceptions.AccessDenied',
  'AccessError',
  'AccessDenied',
];

export class OdooRpcClient {
  constructor(
    private readonly config: OdooRpcConfig,
    private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch
  ) {}

  /**
   * Wrapper de `object.execute_kw`. `kwargs.context` se mezcla con
   * `allowed_company_ids` cuando la config lo trae: multi-empresa se resuelve
   * acá, no en cada método del adapter.
   */
  async executeKw<T>(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown> = {}
  ): Promise<T> {
    const context = this.buildContext(
      kwargs.context && typeof kwargs.context === 'object'
        ? (kwargs.context as Record<string, unknown>)
        : undefined
    );
    const finalKwargs: Record<string, unknown> = { ...kwargs, context };

    const payload = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [this.config.db, this.config.uid, this.config.apiKey, model, method, args, finalKwargs],
      },
    };

    const url = `${this.config.baseUrl.replace(/\/+$/, '')}/jsonrpc`;
    const controller = new AbortController();
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ErpConnectionError(`Odoo: no se pudo conectar a ${url} (${reason}).`);
    } finally {
      clearTimeout(timeout);
    }

    // Un 5xx real (sin cuerpo JSON-RPC) sí llega como HTTP no-2xx.
    if (response.status >= 500) {
      const detail = await response.text().catch(() => '');
      throw new ErpConnectionError(
        `Odoo: error del servidor (HTTP ${response.status})${detail ? ` — ${detail.slice(0, 300)}` : ''}`
      );
    }
    if (!response.ok) {
      // Odoo suele devolver 200 incluso en errores de aplicación; cualquier otro
      // no-2xx es una respuesta del reverse-proxy o del framework.
      const detail = await response.text().catch(() => '');
      if (response.status === 401 || response.status === 403) {
        throw new ErpAuthError(
          `Odoo: acceso rechazado (HTTP ${response.status})${detail ? ` — ${detail.slice(0, 300)}` : ''}`
        );
      }
      throw new ErpNonRetryableError(
        `Odoo: la API rechazó la operación (HTTP ${response.status})${detail ? ` — ${detail.slice(0, 300)}` : ''}`
      );
    }

    let body: OdooRpcResponse<T>;
    try {
      body = (await response.json()) as OdooRpcResponse<T>;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ErpConnectionError(`Odoo: respuesta no era JSON válido (${reason}).`);
    }

    if (body.error) {
      throw this.translateError(body.error);
    }
    return body.result as T;
  }

  private buildContext(userContext?: Record<string, unknown>): Record<string, unknown> {
    const ctx: Record<string, unknown> = { ...(userContext ?? {}) };
    if (this.config.allowedCompanyIds && this.config.allowedCompanyIds.length > 0) {
      // El caller puede pisar `allowed_company_ids` puntualmente si lo mete en
      // el kwargs.context — se respeta ese override.
      if (ctx.allowed_company_ids === undefined) {
        ctx.allowed_company_ids = [...this.config.allowedCompanyIds];
      }
    }
    return ctx;
  }

  /**
   * Traduce el `error` de Odoo a la taxonomía del módulo. La decisión se toma
   * por `data.name` (el nombre calificado de la excepción de Python): el `code`
   * es siempre 200/100 y no discrimina.
   */
  private translateError(error: OdooRpcError): Error {
    const name = error.data?.name ?? '';
    const message =
      error.data?.message?.trim() ||
      error.message?.trim() ||
      'Odoo: error sin descripción.';

    if (AUTH_ERROR_NAMES.some((candidate) => name.includes(candidate))) {
      return new ErpAuthError(`Odoo: ${message}`);
    }
    // ValidationError y otros errores de negocio (UserError, MissingError):
    // reintentar no los arregla — hay que corregir los datos o los args.
    return new ErpNonRetryableError(`Odoo: ${message}`);
  }
}
