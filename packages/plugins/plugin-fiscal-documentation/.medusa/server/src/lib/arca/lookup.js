"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupTaxpayer = lookupTaxpayer;
const cuit_1 = require("../../lib/cuit");
const config_1 = require("./config");
const constancia_1 = require("./constancia");
const mapper_1 = require("./mapper");
const wsaa_1 = require("./wsaa");
const types_1 = require("./types");
/** Fachada pública del módulo: lo único que consume la ruta store. */
const PERSONA_TTL_SECONDS = 24 * 60 * 60;
/** Cache negativo corto: evita martillar ARCA con CUITs inexistentes. */
const NOT_FOUND_TTL_SECONDS = 60 * 60;
async function lookupTaxpayer(rawCuit, opts) {
    const cuit = String(rawCuit ?? '').replace(/\D/g, '');
    if (!(0, cuit_1.validateCuit)(cuit))
        throw new types_1.ArcaInvalidCuitError();
    const cfg = opts.config ?? (0, config_1.getArcaConfig)();
    /**
     * El cache de personas NO lleva el CUIT representada, a diferencia del del ticket
     * (`wsaa.ts:ticketIdentity`). La constancia de inscripción de un CUIT es un dato
     * PÚBLICO e idéntico lo pregunte quien lo pregunte, así que compartirlo entre
     * tiendas no filtra nada y ahorra viajes a un servicio de AFIP que se cae seguido.
     * Lo que sí cambia por entorno es el padrón consultado, y eso ya está en la clave.
     */
    const cacheKey = `arca:persona:${cfg.environment}:${cuit}`;
    const cached = await opts.cache.get(cacheKey);
    if (cached) {
        if (cached.not_found === true)
            throw new types_1.ArcaNotFoundError();
        return cached;
    }
    // Se le pasa `cfg` explícito y no `opts`: si `opts.config` viniera vacío, WSAA
    // resolvería la config de la INSTANCIA y firmaría con el certificado equivocado
    // mientras el resto de esta función usa el de la tienda.
    const ticket = await (0, wsaa_1.getWsaaTicket)({ ...opts, config: cfg });
    let persona;
    try {
        persona = await (0, constancia_1.callGetPersona)({
            ticket,
            cuitRepresentada: cfg.cuitRepresentada,
            idPersona: cuit,
            padronUrl: cfg.urls.padron,
            fetchImpl: opts.fetchImpl,
        });
    }
    catch (error) {
        if (error instanceof types_1.ArcaNotFoundError) {
            await opts.cache.set(cacheKey, { not_found: true }, NOT_FOUND_TTL_SECONDS);
        }
        throw error;
    }
    const taxpayer = (0, mapper_1.mapPersonaToTaxpayer)(persona, cuit);
    await opts.cache.set(cacheKey, taxpayer, PERSONA_TTL_SECONDS);
    return taxpayer;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9va3VwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9hcmNhL2xvb2t1cC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQW9CQSx3Q0FzREM7QUExRUQseUNBQThDO0FBQzlDLHFDQUEwRDtBQUMxRCw2Q0FBOEM7QUFDOUMscUNBQWdEO0FBQ2hELGlDQUF1QztBQUN2QyxtQ0FLaUI7QUFFakIsc0VBQXNFO0FBRXRFLE1BQU0sbUJBQW1CLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUM7QUFDekMseUVBQXlFO0FBQ3pFLE1BQU0scUJBQXFCLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQztBQUkvQixLQUFLLFVBQVUsY0FBYyxDQUNsQyxPQUFlLEVBQ2YsSUFTQztJQUVELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN0RCxJQUFJLENBQUMsSUFBQSxtQkFBWSxFQUFDLElBQUksQ0FBQztRQUFFLE1BQU0sSUFBSSw0QkFBb0IsRUFBRSxDQUFDO0lBRTFELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLElBQUksSUFBQSxzQkFBYSxHQUFFLENBQUM7SUFDM0M7Ozs7OztPQU1HO0lBQ0gsTUFBTSxRQUFRLEdBQUcsZ0JBQWdCLEdBQUcsQ0FBQyxXQUFXLElBQUksSUFBSSxFQUFFLENBQUM7SUFDM0QsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBZ0IsUUFBUSxDQUFDLENBQUM7SUFDN0QsSUFBSSxNQUFNLEVBQUUsQ0FBQztRQUNYLElBQUssTUFBa0MsQ0FBQyxTQUFTLEtBQUssSUFBSTtZQUFFLE1BQU0sSUFBSSx5QkFBaUIsRUFBRSxDQUFDO1FBQzFGLE9BQU8sTUFBNEIsQ0FBQztJQUN0QyxDQUFDO0lBRUQsK0VBQStFO0lBQy9FLGdGQUFnRjtJQUNoRix5REFBeUQ7SUFDekQsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLG9CQUFhLEVBQUMsRUFBRSxHQUFHLElBQUksRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUM3RCxJQUFJLE9BQU8sQ0FBQztJQUNaLElBQUksQ0FBQztRQUNILE9BQU8sR0FBRyxNQUFNLElBQUEsMkJBQWMsRUFBQztZQUM3QixNQUFNO1lBQ04sZ0JBQWdCLEVBQUUsR0FBRyxDQUFDLGdCQUFnQjtZQUN0QyxTQUFTLEVBQUUsSUFBSTtZQUNmLFNBQVMsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU07WUFDMUIsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTO1NBQzFCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsSUFBSSxLQUFLLFlBQVkseUJBQWlCLEVBQUUsQ0FBQztZQUN2QyxNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO1FBQzdFLENBQUM7UUFDRCxNQUFNLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFRCxNQUFNLFFBQVEsR0FBRyxJQUFBLDZCQUFvQixFQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNyRCxNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztJQUM5RCxPQUFPLFFBQVEsQ0FBQztBQUNsQixDQUFDIn0=