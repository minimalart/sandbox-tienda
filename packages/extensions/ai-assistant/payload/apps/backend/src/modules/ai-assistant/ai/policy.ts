import type { PolicyMode } from './types';
import { isNativeTool } from './native-tools/names';

/**
 * Clasificación read/write y permisos por (tool, acción, resource) del MCP.
 *
 * Las tools `manage_medusa_admin_*` reciben un parámetro `action` (list/get/
 * cancel/create/…). El gating es por (tool, acción): una misma tool mezcla
 * lecturas y escrituras. Algunas tools (p. ej. `manage_minimalart_extensions`)
 * además exponen un parámetro `resource` (enum) que agrupa varias entidades
 * bajo un mismo set de acciones genéricas; para esas, el gating es por
 * (tool, acción, resource). Para las tools sin `resource`, el resource es ''.
 */

const READ_ACTION_RE = /^(list|get|retrieve|search|count|find)(_|$)/i;

/**
 * Resources de `manage_minimalart_extensions` que son de solo lectura: no se
 * pueden mutar (cualquier acción de escritura sobre ellos queda prohibida).
 */
const EXTENSION_READ_ONLY_RESOURCES = new Set([
  'commerce_dashboard',
  'contact_submissions',
  'sales_channels_b2c',
]);

/**
 * Resources de `manage_minimalart_extensions` que SOLO se crean/editan con tools
 * nativas (create_blog_post / generate_image), nunca por el CRUD genérico: el
 * camino nativo arma el contenido bien (Tiptap, imagen real subida, devuelve id) y
 * el genérico produce basura (placeholders, estado perdido, confirmaciones). Las
 * lecturas siguen permitidas; solo se prohíbe la ESCRITURA por el MCP genérico.
 */
const EXTENSION_NATIVE_ONLY_RESOURCES = new Set(['blog_posts', 'media_library']);

/** `manage_medusa_admin_v2` con action `request` = escape hatch a cualquier
 * endpoint admin (incluye escrituras arbitrarias) → peligroso. */
function isDangerousEscapeHatch(toolName: string, action: string): boolean {
  return toolName === 'manage_medusa_admin_v2' && action === 'request';
}

/**
 * Tools sintéticas de memoria (no son del MCP; las intercepta `runLoop`, como el
 * handoff). `search_memory` es solo lectura; `remember` escribe una memoria de bajo
 * riesgo (la "aprobación" de la auto-captura se modela con `status='pending'`, no
 * cortando el turno). Ambas corren como `auto` para no caer en el gate de aprobación.
 */
export const SEARCH_MEMORY_TOOL = 'search_memory';
export const REMEMBER_TOOL = 'remember';
export function isMemoryTool(name: string): boolean {
  return name === SEARCH_MEMORY_TOOL || name === REMEMBER_TOOL;
}

export function classifyAction(action: string): 'read' | 'write' {
  return READ_ACTION_RE.test(action) ? 'read' : 'write';
}

/** Default cuando no hay override en DB. */
export function defaultMode(toolName: string, action: string, resource?: string): PolicyMode {
  // Tools nativas (generar imagen, crear/editar borrador de blog, linkear productos):
  // bajo riesgo (nunca publican) → auto, para no cortar el pipeline de contenido.
  if (isNativeTool(toolName)) return 'auto';
  if (isMemoryTool(toolName)) return 'auto';
  if (isDangerousEscapeHatch(toolName, action)) return 'prohibited';
  // Recursos read-only de la tool de extensiones: nunca se pueden mutar.
  if (
    toolName === 'manage_minimalart_extensions' &&
    resource &&
    EXTENSION_READ_ONLY_RESOURCES.has(resource) &&
    classifyAction(action) === 'write'
  ) {
    return 'prohibited';
  }
  // Blog/media: la ESCRITURA por el CRUD genérico se prohíbe → se fuerza el uso de
  // las tools nativas (create_blog_post / generate_image), que arman el contenido bien.
  if (
    toolName === 'manage_minimalart_extensions' &&
    resource &&
    EXTENSION_NATIVE_ONLY_RESOURCES.has(resource) &&
    classifyAction(action) === 'write'
  ) {
    return 'prohibited';
  }
  return classifyAction(action) === 'read' ? 'auto' : 'ask';
}

export type PolicyOverride = {
  tool_name: string;
  action: string;
  resource: string;
  mode: PolicyMode;
};

/** Resource declarado en los args del tool call (o '' si no aplica). */
export function resourceFromArgs(args: Record<string, unknown>): string {
  const r = args?.resource;
  return typeof r === 'string' && r.length > 0 ? r : '';
}

function key(tool: string, action: string, resource: string): string {
  return `${tool}:${action}:${resource || ''}`;
}

/** Resuelve el modo efectivo: override en DB, si no, default. */
export function resolveMode(
  toolName: string,
  action: string,
  resource: string,
  overrides: PolicyOverride[],
): PolicyMode {
  const map = new Map(
    overrides.map((o) => [key(o.tool_name, o.action, o.resource || ''), o.mode]),
  );
  return (
    map.get(key(toolName, action, resource)) ?? defaultMode(toolName, action, resource)
  );
}

/** Acción declarada por el modelo en los args del tool call (o '*' si no hay). */
export function actionFromArgs(args: Record<string, unknown>): string {
  const a = args?.action;
  return typeof a === 'string' && a.length > 0 ? a : '*';
}
