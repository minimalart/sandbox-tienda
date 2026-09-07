"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const lookup_1 = require("../../../../lib/arca/lookup");
const config_1 = require("../../../../lib/arca/config");
const types_1 = require("../../../../lib/arca/types");
/**
 * Consulta la constancia de inscripción de un CUIT en ARCA y devuelve los
 * datos fiscales normalizados para autocompletar Factura A en el checkout.
 * Público (solo publishable key: el checkout soporta guest); protegido por
 * rate limit por IP + cache por CUIT. Nunca expone la respuesta SOAP cruda.
 *
 * Endurecida a prueba de fallas: TODA salida es JSON (nunca rethrow — el
 * checkout no puede depender de este endpoint) y el cache del container
 * tiene fallback in-memory por si el módulo CACHE no resuelve.
 */
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
function resolveCache(req) {
    try {
        const cache = req.scope.resolve(utils_1.Modules.CACHE);
        if (cache && typeof cache.get === 'function' && typeof cache.set === 'function') {
            return cache;
        }
    }
    catch {
        // Sin módulo CACHE en el container: fallback in-memory.
    }
    return memoryArcaCache;
}
function resolveLog(req) {
    try {
        const logger = req.scope.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
        return (line) => logger.info(line);
    }
    catch {
        return (line) => console.log(line);
    }
}
/** Logger mínimo para `getArcaConfigForSite`, que sólo avisa cuando degrada. */
function resolveWarn(req) {
    try {
        const logger = req.scope.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
        return { warn: (line) => logger.warn(line) };
    }
    catch {
        return { warn: (line) => console.warn(line) };
    }
}
/**
 * La tienda sale de la PUBLISHABLE KEY: acá no hay header `x-site-id` —eso es del
 * admin— y el storefront no manda ninguno. Mismo camino que
 * `store/gift-card-experience/designs/route.ts`.
 *
 * Importa más que en cualquier otra ruta store del repo: lo que se resuelve con esto
 * es CON QUÉ CERTIFICADO se le habla a AFIP. Sin la tienda, la consulta sale con la
 * identidad fiscal de la instancia; con ella, una tienda secundaria que no cargó la
 * suya queda apagada por fail-closed en vez de usar la ajena.
 */
function salesChannelOf(req) {
    const channelIds = req.publishable_key_context?.sales_channel_ids;
    return channelIds?.[0] ?? null;
}
/**
 * Diagnóstico liviano: dice si la INSTANCIA tiene la identidad fiscal cargada.
 *
 * Sigue siendo de instancia y no de tienda a propósito. Es un endpoint público (sólo
 * publishable key) que el storefront usa para decidir si muestra el autocompletado
 * de Factura A; responder por tienda le daría a cualquiera con una publishable key
 * un mapa de qué tiendas del backend tienen certificado propio. El POST sí resuelve
 * la tienda, que es donde importa.
 */
async function GET(_req, res) {
    res.json({ configured: (0, config_1.isArcaConfigured)() });
}
async function POST(req, res) {
    const started = Date.now();
    const log = resolveLog(req);
    const cuit = String(req.validatedBody?.cuit ?? '').replace(/\D/g, '');
    const done = (outcome) => log(`[ARCA] lookup cuit=${cuit} outcome=${outcome} ms=${Date.now() - started}`);
    try {
        log(`[ARCA] lookup start cuit=${cuit} configured=${(0, config_1.isArcaConfigured)()}`);
        const config = await (0, config_1.getArcaConfigForSite)(req.scope, { salesChannelId: salesChannelOf(req) }, resolveWarn(req));
        const taxpayer = await (0, lookup_1.lookupTaxpayer)(cuit, { cache: resolveCache(req), config });
        done('ok');
        res.json({ taxpayer });
    }
    catch (error) {
        if (error instanceof types_1.ArcaInvalidCuitError) {
            done('invalid');
            res.status(400).json({ message: error.message });
            return;
        }
        if (error instanceof types_1.ArcaNotFoundError) {
            done('not_found');
            res
                .status(404)
                .json({ message: 'No encontramos ese CUIT en ARCA. Revisalo o completá los datos a mano.' });
            return;
        }
        if (!(error instanceof types_1.ArcaConfigError) && !(error instanceof types_1.ArcaUnavailableError)) {
            // Error inesperado: dejar el stack en los logs del server (nunca al
            // cliente) y degradar a 503 igual — este endpoint jamás debe romper
            // el checkout ni matar la conexión.
            const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
            console.error(`[ARCA] lookup error inesperado cuit=${cuit}:`, detail);
        }
        done('unavailable');
        // 424 (Failed Dependency) y no 503: DO App Platform intercepta los 503
        // que devuelve la app y los reemplaza por su página de error
        // "via_upstream" (el navegador ve un 504 de DO sin nuestro JSON). Fue la
        // causa raíz del bug del checkout: el endpoint respondía 503 limpio y la
        // plataforma lo pisaba. El storefront solo mira res.ok + message.
        res
            .status(424)
            .json({ message: 'No pudimos consultar ARCA en este momento. Completá los datos a mano.' });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2FyY2EvdGF4cGF5ZXItbG9va3VwL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBdUdBLGtCQUVDO0FBRUQsb0JBbURDO0FBN0pELHFEQUErRTtBQUMvRSx3REFBNkQ7QUFDN0Qsd0RBQXFGO0FBQ3JGLHNEQU1vQztBQUdwQzs7Ozs7Ozs7O0dBU0c7QUFFSCxNQUFNLGdCQUFnQixHQUFHLEtBQUssQ0FBQztBQUMvQixNQUFNLFdBQVcsR0FBRyxJQUFJLEdBQUcsRUFBZ0QsQ0FBQztBQUM1RSxNQUFNLGVBQWUsR0FBYztJQUNqQyxLQUFLLENBQUMsR0FBRyxDQUFJLEdBQVc7UUFDdEIsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNuQyxJQUFJLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7WUFDNUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN4QixPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDRCxPQUFPLEtBQUssQ0FBQyxJQUFTLENBQUM7SUFDekIsQ0FBQztJQUNELEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBVyxFQUFFLElBQWEsRUFBRSxHQUFHLEdBQUcsSUFBSTtRQUM5QyxJQUFJLFdBQVcsQ0FBQyxJQUFJLEdBQUcsZ0JBQWdCLEVBQUUsQ0FBQztZQUN4QyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDdkIsS0FBSyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLFdBQVcsRUFBRSxDQUFDO2dCQUNqQyxJQUFJLENBQUMsQ0FBQyxTQUFTLElBQUksR0FBRztvQkFBRSxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMs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