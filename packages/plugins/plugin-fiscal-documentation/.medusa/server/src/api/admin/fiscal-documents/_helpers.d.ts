import type { MedusaRequest } from '@medusajs/framework/http';
import { type ArcaConfig, type ArcaConfigStatus } from '../../../lib/arca/config';
import type { ArcaCache } from '../../../lib/arca/types';
import { type FiscalConfig } from '../../../modules/fiscal-documentation/config';
import type { FiscalOwnerType, FiscalSnapshot } from '../../../modules/fiscal-documentation/types';
export declare function resolveArcaCache(req: MedusaRequest): ArcaCache;
/**
 * La config de ARCA de la TIENDA ACTIVA del admin.
 *
 * Sin esto, emitir una constancia desde la pantalla de la tienda B consultaba AFIP
 * con el certificado de la instancia — o sea, en nombre del contribuyente
 * equivocado— y el documento quedaba archivado como si fuera de B. Es el mismo bug
 * que `correo-argentino-fulfillment/get-client.ts` documenta para el despacho, con
 * la diferencia de que acá el rastro es fiscal.
 *
 * TIRA cuando la tienda no tiene identidad fiscal propia (fail-closed) o cuando sus
 * credenciales no se pueden descifrar. Los dos casos los traduce el caller a un 424,
 * que es el contrato que ya tenía la ruta.
 */
export declare function resolveArcaConfig(req: MedusaRequest): Promise<ArcaConfig>;
/**
 * Estado de la conexión con ARCA para la card del admin. NUNCA material sensible.
 *
 * Devuelve `null` si ni siquiera se pudo leer la configuración: la card muestra la
 * sección vacía en vez de romper la pantalla entera de Preferencias, que también
 * sirve para cosas que no tienen nada que ver con ARCA.
 */
export declare function readArcaStatus(req: MedusaRequest): Promise<ArcaConfigStatus | null>;
/**
 * Nombre de la empresa dueña, para el encabezado del PDF. Best-effort: los
 * módulos corporate/company son opcionales y pueden no estar instalados.
 */
export declare function resolveOwnerName(req: MedusaRequest, ownerType: FiscalOwnerType, ownerId: string): Promise<string>;
/** Config de la extensión (best-effort: defaults si el módulo no resuelve). */
/**
 * Exige que el owner (empresa o corporate) sea de la tienda activa.
 *
 * El documento fiscal no tiene eje propio —`owner_type` es polimórfico—, pero su dueño
 * sí: los dos tipos posibles ya saben a qué tienda pertenecen. Sin esto, saber el
 * `owner_id` de una empresa ajena alcanza para ver su constancia de AFIP, que trae
 * CUIT, razón social y domicilio fiscal.
 */
export declare function assertFiscalOwnerInSite(req: MedusaRequest, ownerType: 'corporate' | 'company', ownerId: string): Promise<void>;
/**
 * Igual que `assertFiscalOwnerInSite`, pero cuando lo único que hay es el id del
 * documento: se lee su owner y se valida ese.
 *
 * Hace falta en el detalle, el diff y la descarga — las tres reciben un `fdoc_...` y
 * ninguna pide el owner. Sin esto, un id adivinado baja el PDF de la constancia de otra
 * tienda, con CUIT y domicilio fiscal adentro.
 */
export declare function assertFiscalDocumentInSite(req: MedusaRequest, documentId: string): Promise<void>;
/** La tienda activa, o `null` para la fila GLOBAL de la instancia. */
export declare function fiscalSiteOf(req: MedusaRequest): Promise<string | null>;
/**
 * La configuración fiscal EFECTIVA: la de la tienda si la definió, la global si no.
 *
 * Es la config más sensible del repo — CUIT, punto de venta, condición frente al IVA.
 * `getSiteSetting` lee EXACTAMENTE el scope que se le pide (no hace precedencia), así
 * que la cadena se arma acá: primero la tienda, después la global.
 *
 * Sin este fallback, una tienda que todavía no configuró lo suyo se quedaría sin
 * ninguna config en vez de heredar la de la instancia, y dejaría de emitir.
 */
export declare function readFiscalConfig(req: MedusaRequest): Promise<FiscalConfig>;
export declare function writeFiscalConfig(req: MedusaRequest, config: FiscalConfig): Promise<FiscalConfig>;
/**
 * Actualiza los datos de la empresa dueña a partir del snapshot (best-effort):
 * razón social + CUIT y metadata fiscal (last_fiscal_sync, last_snapshot_hash,
 * last_fiscal_document, arca_verified).
 */
export declare function applyOwnerUpdate(req: MedusaRequest, ownerType: FiscalOwnerType, ownerId: string, snapshot: FiscalSnapshot, documentId: string, snapshotHash: string): Promise<void>;
