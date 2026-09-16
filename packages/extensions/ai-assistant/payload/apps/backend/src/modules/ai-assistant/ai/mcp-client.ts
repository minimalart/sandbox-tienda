/**
 * Cliente MCP SALIENTE: habla con servidores MCP externos (de terceros) por
 * HTTP (Streamable HTTP, con fallback a SSE). Lo usa el agregador (`tool-registry`)
 * para descubrir tools (cacheado) y ejecutarlas (conexión efímera por llamada).
 *
 * El SDK `@modelcontextprotocol/sdk` es ESM puro; como el backend se compila a
 * CJS, se carga con el mismo dynamic import OCULTO que `api/mcp/_loader.ts` (un
 * import estático rompería con ERR_REQUIRE_ESM). Por eso los objetos del SDK se
 * tipan como `any`; los contratos públicos de este archivo sí están tipados.
 *
 * Ninguna función de acá lanza hacia afuera: discovery y ejecución devuelven un
 * resultado estructurado para que un servidor caído nunca rompa el chat ni las
 * tools internas.
 */

const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;

type McpSdk = {
  Client: any;
  StreamableHTTPClientTransport: any;
  SSEClientTransport: any;
};

let sdkPromise: Promise<McpSdk> | null = null;

/** Carga (y memoiza) las 3 piezas del cliente del SDK MCP. */
export function loadMcpSdk(): Promise<McpSdk> {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const [client, http, sse] = await Promise.all([
        dynamicImport('@modelcontextprotocol/sdk/client/index.js'),
        dynamicImport('@modelcontextprotocol/sdk/client/streamableHttp.js'),
        dynamicImport('@modelcontextprotocol/sdk/client/sse.js'),
      ]);
      return {
        Client: client.Client,
        StreamableHTTPClientTransport: http.StreamableHTTPClientTransport,
        SSEClientTransport: sse.SSEClientTransport,
      };
    })();
  }
  return sdkPromise;
}

export type TransportKind = 'http' | 'sse';

/** Datos mínimos para abrir una conexión a un servidor MCP externo. */
export type ExternalConn = {
  url: string;
  transport: TransportKind;
  headers: Record<string, string>;
  timeoutMs: number;
};

export type DiscoveredTool = {
  name: string;
  description?: string;
  /** JSON Schema de los argumentos (inputSchema del MCP). */
  parameters?: unknown;
  read_only_hint?: boolean;
};

export type DiscoverResult = {
  ok: boolean;
  transportUsed?: TransportKind;
  tools: DiscoveredTool[];
  error?: string;
};

export type ToolContent = { content: Array<{ type: string; text: string }> };

function errMessage(e: unknown): string {
  const err = e as { message?: string } | undefined;
  return (err?.message ?? String(e ?? 'error desconocido')).slice(0, 300);
}

/** `fetch` con timeout por AbortController (el SDK acepta un fetch custom). */
function timeoutFetch(timeoutMs: number) {
  return (input: any, init: any = {}) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error(`timeout tras ${timeoutMs}ms`)), timeoutMs);
    return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
  };
}

function makeTransport(kind: TransportKind, conn: ExternalConn, sdk: McpSdk) {
  const url = new URL(conn.url);
  const fetchImpl = timeoutFetch(conn.timeoutMs);
  if (kind === 'sse') {
    return new sdk.SSEClientTransport(url, {
      requestInit: { headers: conn.headers },
      // El GET del stream SSE también necesita los headers de auth.
      eventSourceInit: {
        fetch: (u: any, i: any = {}) =>
          fetchImpl(u, { ...i, headers: { ...(i.headers ?? {}), ...conn.headers } }),
      },
    });
  }
  return new sdk.StreamableHTTPClientTransport(url, {
    requestInit: { headers: conn.headers },
    fetch: fetchImpl,
  });
}

/** Conecta con un transport dado, corre `fn(client)` y cierra siempre. */
async function withClient<T>(
  kind: TransportKind,
  conn: ExternalConn,
  fn: (client: any) => Promise<T>,
): Promise<T> {
  const sdk = await loadMcpSdk();
  const client = new sdk.Client(
    { name: 'medusa-ai-assistant', version: '1.0.0' },
    { capabilities: {} },
  );
  const transport = makeTransport(kind, conn, sdk);
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

/**
 * Descubre las tools de un servidor externo. Prueba el transport preferido y, si
 * la conexión falla, cae al otro (http↔sse). Nunca lanza.
 */
export async function discoverExternalTools(conn: ExternalConn): Promise<DiscoverResult> {
  const order: TransportKind[] = conn.transport === 'sse' ? ['sse', 'http'] : ['http', 'sse'];
  let lastError: unknown;
  for (const kind of order) {
    try {
      const tools = await withClient(kind, conn, async (client) => {
        const res = await client.listTools();
        const list = Array.isArray(res?.tools) ? res.tools : [];
        return list.map(
          (t: any): DiscoveredTool => ({
            name: String(t.name),
            description: t.description ? String(t.description) : undefined,
            parameters: t.inputSchema ?? undefined,
            read_only_hint: t.annotations?.readOnlyHint === true ? true : undefined,
          }),
        );
      });
      return { ok: true, transportUsed: kind, tools };
    } catch (e) {
      lastError = e;
    }
  }
  return { ok: false, tools: [], error: errMessage(lastError) };
}

/** Aplana el `content` del MCP a un único bloque de texto (lo que consume el loop). */
function flattenContent(res: any): Array<{ type: string; text: string }> {
  const blocks = Array.isArray(res?.content) ? res.content : [];
  const text = blocks
    .map((b: any) => {
      if (b?.type === 'text' && typeof b.text === 'string') return b.text;
      if (b?.type === 'resource' && typeof b?.resource?.text === 'string') return b.resource.text;
      return JSON.stringify(b);
    })
    .join('\n')
    .trim();
  const finalText = res?.isError ? `Error de herramienta MCP: ${text}` : text || JSON.stringify(res ?? {});
  return [{ type: 'text', text: finalText }];
}

/**
 * Ejecuta una tool de un servidor externo (conexión efímera). Nunca lanza: ante
 * cualquier error devuelve un `content` de texto accionable (mismo patrón que el
 * `catch` de `execTool` para las tools internas).
 */
export async function callExternalTool(
  conn: ExternalConn,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolContent> {
  try {
    return await withClient(conn.transport, conn, async (client) => {
      const res = await client.callTool({ name: toolName, arguments: args ?? {} });
      return { content: flattenContent(res) };
    });
  } catch (e) {
    return {
      content: [
        {
          type: 'text',
          text: `Error ejecutando la tool externa "${toolName}": ${errMessage(
            e,
          )}. El servidor MCP puede estar caído, lento o con credenciales inválidas; avisale al usuario en vez de reintentar en loop.`,
        },
      ],
    };
  }
}
