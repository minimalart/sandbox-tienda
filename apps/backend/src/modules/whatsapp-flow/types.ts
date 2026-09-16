export const WHATSAPP_FLOW_MODULE = 'whatsappFlow';

/**
 * Estados de una versión del grafo.
 *
 *  - `draft`      — se está editando. Uno solo por flujo y tienda.
 *  - `ready`      — validada, todavía no sirve. Es el paso intermedio del publish.
 *  - `active`     — la que atiende las conversaciones. Una sola por flujo y tienda.
 *  - `superseded` — la reemplazó otra. Se conserva para poder volver atrás.
 *
 * `ready` parece de más con un solo editor, pero no lo es: publicar es
 * `draft → ready → activateVersion()`, y si el swap falla la versión queda `ready`
 * en vez de perderse o quedar a medio activar.
 */
export const FLOW_VERSION_STATUSES = ['draft', 'ready', 'active', 'superseded'] as const;
export type FlowVersionStatus = (typeof FLOW_VERSION_STATUSES)[number];

/** El flujo del bot. Hoy hay uno solo; la key existe para no cerrarse a más. */
export const DEFAULT_FLOW_KEY = 'conversation';
