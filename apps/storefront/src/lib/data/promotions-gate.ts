/**
 * ¿Se muestran los accesos a "Promociones" del chrome? Decisión PURA.
 *
 * Módulo separado de `active-promotion-ids.ts` a propósito: ese hace I/O
 * (`server-only`, Admin API, `unstable_cache`) y no se puede testear con
 * `node --test`. Acá vive la lógica que se rompió en producción, y
 * `promotions-gate.test.ts` la fija. Mismo patrón que `tinting-gate.ts`.
 *
 * El bug (DESDEELSUR-30): la card "Descuentos y promociones exclusivas" del menú
 * mobile aparecía en una tienda con CERO promociones cargadas en el back. El gate
 * ya existía, pero fallaba ABIERTO: ante cualquier error del Admin API devolvía
 * `true` ("comportamiento histórico"). En desdeelsur la consulta de promociones
 * reventaba —el storefront pregunta por el Admin API, que necesita
 * `MEDUSA_ADMIN_API_KEY`— así que el gate contestaba `true` para siempre.
 *
 * La distinción que faltaba es entre TRES estados, no dos:
 *
 *  - hay promociones activas      → se muestra el acceso
 *  - NO hay promociones activas   → no se muestra (la PLP saldría vacía)
 *  - NO SE PUDO AVERIGUAR         → tampoco se muestra
 *
 * El tercero se trataba como el primero. Ahora se trata como el segundo, y no es
 * un capricho: el acceso lleva a `/store?promos=1`, y esa PLP se arma con la
 * MISMA lista de IDs. Si la lista no se pudo traer, el destino no es una vidriera
 * de ofertas —es el catálogo entero sin un solo descuento—, o sea que ofrecer la
 * puerta es peor que esconderla.
 */

export type PromotionsGateInput = {
  /** El canal resuelto por el layout, o vacío si la tienda no tiene ninguno. */
  salesChannelId?: string | null;
  /**
   * ¿El runtime tiene `MEDUSA_ADMIN_API_KEY`? La lista de promociones sale del
   * Admin API, así que sin clave no hay forma de contestar la pregunta. Se pasa
   * como dato y no se lee de `process.env` acá para que el módulo siga siendo
   * puro y testeable.
   */
  hasAdminApiKey: boolean;
  /**
   * IDs de promociones activas para el canal, o `null` cuando la consulta NO SE
   * PUDO HACER. El `null` es el corazón del bug: es un estado distinto de `[]` y
   * confundirlos es lo que dejaba la card prendida.
   */
  activePromotionIds: readonly string[] | null;
};

/** Por qué está oculto. Se loguea; no se le muestra al cliente final. */
export type PromotionsOffReason =
  /** La tienda no tiene canal de ventas resuelto. */
  | "no-sales-channel"
  /** Falta `MEDUSA_ADMIN_API_KEY` en el runtime del storefront. */
  | "no-admin-api-key"
  /** Había canal y clave, pero el Admin API falló. */
  | "lookup-failed"
  /** Todo bien: el canal simplemente no tiene ninguna promoción activa. */
  | "no-active-promotions";

export type PromotionsGate = {
  /** Se pintan los accesos a "Promociones" (pill del nav, menú mobile, bottom nav). */
  accessVisible: boolean;
  /** `null` cuando el acceso se muestra. */
  reason: PromotionsOffReason | null;
};

/**
 * Las razones que NO son "no hay promos": significan que la tienda está mal
 * configurada o el backend falló, y merecen un log. `no-active-promotions` es
 * un estado legítimo y se repite en cada render, así que no se loguea.
 */
export const isPromotionsGateFailure = (
  reason: PromotionsOffReason | null,
): boolean => reason === "no-admin-api-key" || reason === "lookup-failed";

const OFF = (reason: PromotionsOffReason): PromotionsGate => ({
  accessVisible: false,
  reason,
});

export const resolvePromotionsGate = ({
  salesChannelId,
  hasAdminApiKey,
  activePromotionIds,
}: PromotionsGateInput): PromotionsGate => {
  if (!salesChannelId) return OFF("no-sales-channel");
  if (!hasAdminApiKey) return OFF("no-admin-api-key");
  if (activePromotionIds === null) return OFF("lookup-failed");
  if (activePromotionIds.length === 0) return OFF("no-active-promotions");
  return { accessVisible: true, reason: null };
};
