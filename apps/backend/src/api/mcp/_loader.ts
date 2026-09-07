/**
 * Loader del paquete ESM `mcp-medusa` desde el backend de Medusa.
 *
 * `mcp-medusa` es ESM puro (`"type": "module"`), pero `medusa build` compila el
 * backend a CommonJS (SWC). Un `import` normal terminaría como `require()` en el
 * bundle → `ERR_REQUIRE_ESM` en Node < 22. Para evitarlo cargamos el paquete con
 * un `import()` dinámico OCULTO dentro de un `Function`, que ni TS ni SWC degradan
 * a `require` (queda como import nativo en runtime, válido tanto en CJS como ESM).
 *
 * Los módulos se cargan una sola vez (cache) y el handler MCP es un singleton:
 * mantiene su `Map` de sesiones en memoria y su `setInterval` de limpieza.
 */

const dynamicImport = new Function(
  'specifier',
  'return import(specifier)',
) as (specifier: string) => Promise<any>;

// Mínimo contrato que usamos del handler Streamable HTTP del paquete.
export type McpHttpHandler = {
  handleRequest: (req: unknown, res: unknown) => Promise<unknown>;
};

let handlerPromise: Promise<McpHttpHandler> | null = null;

/**
 * Devuelve (y memoiza) el handler MCP Streamable HTTP listo para delegarle
 * `handleRequest(req, res)`. Reusa tools/constants del propio paquete.
 */
export function getMcpHandler(): Promise<McpHttpHandler> {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const [transport, tools, constants] = await Promise.all([
        dynamicImport('mcp-medusa/server/transports/streamable-http.js'),
        dynamicImport('mcp-medusa/lib/tools.js'),
        dynamicImport('mcp-medusa/lib/constants.js'),
      ]);

      return transport.createStreamableHTTPHandler({
        discoverTools: tools.discoverTools,
        transformToolsToMcp: tools.transformToolsToMcp,
        executeToolOptimized: tools.executeToolOptimized,
        serverInfo: constants.SERVER_INFO,
        protocolVersion: constants.MCP_VERSION_HTTP,
      }) as McpHttpHandler;
    })();
  }
  return handlerPromise;
}

/** Carga (y memoiza) los middlewares de auth/cors del paquete. */
let authModulePromise: Promise<{
  authMiddleware: (req: unknown, res: unknown, next: unknown) => unknown;
  corsMiddleware: (req: unknown, res: unknown, next: unknown) => unknown;
}> | null = null;

export function getMcpAuthMiddlewares() {
  if (!authModulePromise) {
    authModulePromise = dynamicImport('mcp-medusa/server/middleware/auth.js');
  }
  return authModulePromise;
}

// Tipos mínimos de las tools del paquete que usa el Asistente IA in-process.
export type McpToolDef = {
  definition: {
    name: string;
    description?: string;
    parameters?: {
      type?: string;
      properties?: Record<string, any>;
      required?: string[];
      [k: string]: any;
    };
  };
  function: (args: Record<string, unknown>) => Promise<unknown>;
  path?: string;
};
export type McpToolsApi = {
  discoverTools: (forceRefresh?: boolean) => Promise<McpToolDef[]>;
  transformToolsToMcp: (
    tools: McpToolDef[],
  ) => Array<{ name: string; description?: string; inputSchema: unknown }>;
  executeToolOptimized: (
    tools: McpToolDef[],
    toolName: string,
    args?: Record<string, unknown>,
  ) => Promise<{ content: Array<{ type: string; text: string }> }>;
};

let toolsApiPromise: Promise<McpToolsApi> | null = null;

/**
 * Devuelve (y memoiza) las funciones de tools del MCP para llamarlas
 * IN-PROCESS desde el Asistente IA (sin pasar por HTTP/JSON-RPC). Las tools
 * leen `process.env.MEDUSA_BASE_URL` + `MEDUSA_API_KEY` al ejecutarse.
 */
export function getMcpTools(): Promise<McpToolsApi> {
  if (!toolsApiPromise) {
    toolsApiPromise = dynamicImport('mcp-medusa/lib/tools.js');
  }
  return toolsApiPromise;
}
