"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveArcaCache = resolveArcaCache;
exports.resolveArcaConfig = resolveArcaConfig;
exports.readArcaStatus = readArcaStatus;
exports.resolveOwnerName = resolveOwnerName;
exports.assertFiscalOwnerInSite = assertFiscalOwnerInSite;
exports.assertFiscalDocumentInSite = assertFiscalDocumentInSite;
exports.fiscalSiteOf = fiscalSiteOf;
exports.readFiscalConfig = readFiscalConfig;
exports.writeFiscalConfig = writeFiscalConfig;
exports.applyOwnerUpdate = applyOwnerUpdate;
const utils_1 = require("@medusajs/framework/utils");
const config_1 = require("../../../lib/arca/config");
const config_2 = require("../../../modules/fiscal-documentation/config");
const request_1 = require("../../../lib/multistore/request");
const fiscal_documentation_1 = require("../../../modules/fiscal-documentation");
/**
 * SHIM del plugin — variantes de `CORPORATE_SITE_SCOPE` y `COMPANY_SITE_SCOPE`.
 *
 * Los descriptores originales viven en `apps/backend/src/modules/corporate/site-scope.ts`
 * y `.../company/site-scope.ts`. El plugin no los puede importar sin acoplarse al
 * árbol del host, así que acá se replican con las columnas mínimas —`site_id` en
 * `corporate` y en `company` respectivamente— manteniendo el mismo `empty: 'all'`
 * histórico. Si el host cambia la forma física (jsonb, tabla puente), este shim
 * queda desactualizado en silencio hasta que `multistore` se plugin-ifique.
 *
 * `assertIdInSite` viene de `lib/multistore/scope.ts` (vendorizado desde catalogador).
 */
const scope_1 = require("../../../lib/multistore/scope");
const CORPORATE_SITE_SCOPE = {
    kind: 'site_column',
    table: 'corporate',
    column: 'site_id',
    empty: 'all',
};
const COMPANY_SITE_SCOPE = {
    kind: 'site_column',
    table: 'company',
    column: 'site_id',
    empty: 'all',
};
/** Fallback in-memory por si el módulo CACHE no resuelve (mismo patrón que store/arca). */
const MEMORY_CACHE_MAX = 2_000;
const memoryStore = new Map();
const memoryArcaCache = {
    async get(key) {
        const entry = memoryStore.get(key);
        if (!entry || entry.expiresAt <= Date.now()) {
            memoryStore.delete(key);
            return null;
        }
        return entry.data;
    },
    async set(key, data, ttl = 3600) {
        if (memoryStore.size > MEMORY_CACHE_MAX) {
            const now = Date.now();
            for (const [k, v] of memoryStore) {
                if (v.expiresAt <= now)
                    memoryStore.delete(k);
            }
        }
        memoryStore.set(key, { data, expiresAt: Date.now() + ttl * 1000 });
    },
};
function resolveArcaCache(req) {
    try {
        const cache = req.scope.resolve(utils_1.Modules.CACHE);
        if (cache && typeof cache.get === 'function' && typeof cache.set === 'function') {
            return cache;
        }
    }
    catch {
        /* fallback */
    }
    return memoryArcaCache;
}
/** Logger mínimo para los caminos de ARCA, que sólo avisan cuando degradan. */
function arcaWarnLogger(req) {
    try {
        const logger = req.scope.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
        return { warn: (line) => logger.warn(line) };
    }
    catch {
        return { warn: (line) => console.warn(line) };
    }
}
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
async function resolveArcaConfig(req) {
    return (0, config_1.getArcaConfigForSite)(req.scope, { siteId: await fiscalSiteOf(req) }, arcaWarnLogger(req));
}
/**
 * Estado de la conexión con ARCA para la card del admin. NUNCA material sensible.
 *
 * Devuelve `null` si ni siquiera se pudo leer la configuración: la card muestra la
 * sección vacía en vez de romper la pantalla entera de Preferencias, que también
 * sirve para cosas que no tienen nada que ver con ARCA.
 */
async function readArcaStatus(req) {
    try {
        return await (0, config_1.loadArcaStatusViaPg)((0, config_1.arcaPgFrom)(req.scope), { siteId: await fiscalSiteOf(req) });
    }
    catch {
        return null;
    }
}
/**
 * Nombre de la empresa dueña, para el encabezado del PDF. Best-effort: los
 * módulos corporate/company son opcionales y pueden no estar instalados.
 */
async function resolveOwnerName(req, ownerType, ownerId) {
    try {
        if (ownerType === 'corporate') {
            const service = req.scope.resolve('corporate');
            const c = await service.retrieveCorporate(ownerId);
            return c?.legal_name || c?.name || '';
        }
        const service = req.scope.resolve('company');
        const c = await service.retrieveCompany(ownerId);
        return c?.legal_name || c?.name || '';
    }
    catch {
        return '';
    }
}
function resolveSiteSettings(req) {
    try {
        return req.scope.resolve('demo_store');
    }
    catch {
        return null;
    }
}
/** Config de la extensión (best-effort: defaults si el módulo no resuelve). */
/**
 * Exige que el owner (empresa o corporate) sea de la tienda activa.
 *
 * El documento fiscal no tiene eje propio —`owner_type` es polimórfico—, pero su dueño
 * sí: los dos tipos posibles ya saben a qué tienda pertenecen. Sin esto, saber el
 * `owner_id` de una empresa ajena alcanza para ver su constancia de AFIP, que trae
 * CUIT, razón social y domicilio fiscal.
 */
async function assertFiscalOwnerInSite(req, ownerType, ownerId) {
    const resolution = await (0, request_1.siteFromRequest)(req);
    const descriptor = ownerType === 'corporate' ? CORPORATE_SITE_SCOPE : COMPANY_SITE_SCOPE;
    await (0, scope_1.assertIdInSite)(req.scope, resolution, descriptor, ownerId);
}
/**
 * Igual que `assertFiscalOwnerInSite`, pero cuando lo único que hay es el id del
 * documento: se lee su owner y se valida ese.
 *
 * Hace falta en el detalle, el diff y la descarga — las tres reciben un `fdoc_...` y
 * ninguna pide el owner. Sin esto, un id adivinado baja el PDF de la constancia de otra
 * tienda, con CUIT y domicilio fiscal adentro.
 */
async function assertFiscalDocumentInSite(req, documentId) {
    const service = req.scope.resolve(fiscal_documentation_1.FISCAL_DOCUMENTATION_MODULE);
    const doc = await service.retrieveFiscalDocument(documentId).catch(() => null);
    if (!doc)
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, 'No encontrado.');
    if (doc.owner_type !== 'corporate' && doc.owner_type !== 'company')
        return;
    await assertFiscalOwnerInSite(req, doc.owner_type, doc.owner_id);
}
/** La tienda activa, o `null` para la fila GLOBAL de la instancia. */
async function fiscalSiteOf(req) {
    const resolution = await (0, request_1.siteFromRequest)(req);
    return resolution.status === 'site' ? resolution.site.id : null;
}
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
async function readFiscalConfig(req) {
    const settings = resolveSiteSettings(req);
    if (!settings)
        return config_2.DEFAULT_FISCAL_CONFIG;
    try {
        const siteId = await fiscalSiteOf(req);
        if (siteId) {
            const own = await settings.getSiteSetting(config_2.FISCAL_CONFIG_NAMESPACE, siteId);
            if (own.value && Object.keys(own.value).length > 0)
                return (0, config_2.normalizeFiscalConfig)(own.value);
        }
        const global = await settings.getSiteSetting(config_2.FISCAL_CONFIG_NAMESPACE);
        return (0, config_2.normalizeFiscalConfig)(global.value);
    }
    catch {
        return config_2.DEFAULT_FISCAL_CONFIG;
    }
}
async function writeFiscalConfig(req, config) {
    const settings = resolveSiteSettings(req);
    if (!settings)
        throw new Error('El módulo de tiendas no está disponible.');
    const actorId = req.auth_context?.actor_id ?? null;
    /**
     * Escribe la fila de la TIENDA activa, no la global.
     *
     * Guardar en la global desde la pantalla de una tienda le cambiaría el CUIT y el
     * punto de venta a todas las que no tienen config propia. Es el peor caso posible de
     * este módulo: un comprobante emitido con el CUIT de otro titular no se deshace.
     */
    const saved = await settings.upsertSiteSetting({
        namespace: config_2.FISCAL_CONFIG_NAMESPACE,
        value: config,
        siteId: await fiscalSiteOf(req),
        actorId,
    });
    return (0, config_2.normalizeFiscalConfig)(saved.value);
}
/**
 * Actualiza los datos de la empresa dueña a partir del snapshot (best-effort):
 * razón social + CUIT y metadata fiscal (last_fiscal_sync, last_snapshot_hash,
 * last_fiscal_document, arca_verified).
 */
async function applyOwnerUpdate(req, ownerType, ownerId, snapshot, documentId, snapshotHash) {
    try {
        const key = ownerType; // 'corporate' | 'company'
        const service = req.scope.resolve(key);
        const retrieve = ownerType === 'corporate' ? service.retrieveCorporate : service.retrieveCompany;
        const update = ownerType === 'corporate' ? service.updateCorporates : service.updateCompanies;
        if (!retrieve || !update)
            return;
        const owner = await retrieve(ownerId);
        const metadata = {
            ...(owner?.metadata ?? {}),
            last_fiscal_sync: snapshot.verified_at,
            last_fiscal_document: documentId,
            last_snapshot_hash: snapshotHash,
            arca_verified: true,
        };
        await update({
            id: ownerId,
            legal_name: snapshot.legal_name,
            tax_id: snapshot.tax_id,
            metadata,
        });
    }
    catch {
        /* best-effort: nunca romper la generación por esto */
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiX2hlbHBlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Zpc2NhbC1kb2N1bWVudHMvX2hlbHBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUEwRUEsNENBVUM7QUF5QkQsOENBRUM7QUFTRCx3Q0FNQztBQU1ELDRDQXFCQztBQThDRCwwREFRQztBQVVELGdFQVdDO0FBR0Qsb0NBR0M7QUFZRCw0Q0FjQztBQUVELDhDQXFCQztBQU9ELDRDQXFDQztBQXRVRCxxREFBNEY7QUFDNUYscURBTWtDO0FBRWxDLHlFQUtzRDtBQUd0RCw2REFBa0U7QUFFbEUsZ0ZBQW9GO0FBRXBGOzs7Ozs7Ozs7OztHQVdHO0FBQ0gseURBQStEO0FBRy9ELE1BQU0sb0JBQW9CLEdBQXdCO0lBQ2hELElBQUksRUFBRSxhQUFhO0lBQ25CLEtBQUssRUFBRSxXQUFXO0lBQ2xCLE1BQU0sRUFBRSxTQUFTO0lBQ2pCLEtBQUssRUFBRSxLQUFLO0NBQ2IsQ0FBQztBQUVGLE1BQU0sa0JBQWtCLEdBQXdCO0lBQzlDLElBQUksRUFBRSxhQUFhO0lBQ25CLEtBQUssRUFBRSxTQUFTO0lBQ2hCLE1BQU0sRUFBRSxTQUFTO0lBQ2pCLEtBQUssRUFBRSxLQUFLO0NBQ2IsQ0FBQztBQUVGLDJGQUEyRjtBQUMzRixNQUFNLGdCQUFnQixHQUFHLEtBQUssQ0FBQztBQUMvQixNQUFNLFdBQVcsR0FBRyxJQUFJLEdBQUcsRUFBZ0QsQ0FBQztBQUM1RSxNQUFNLGVBQWUsR0FBYztJQUNqQyxLQUFLLENBQUMsR0FBRyxDQUFJLEdBQVc7UUFDdEIsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNuQyxJQUFJLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7WUFDNUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFH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