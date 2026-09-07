"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.siteOf = void 0;
const request_1 = require("../../../lib/multistore/request");
/**
 * La tienda de esta request, en la forma que espera `store-config`.
 *
 * `null` = la fila GLOBAL, que es el fallback de toda tienda sin config propia.
 * `singleSite` cae a global a propósito: con una sola tienda no hay nada que
 * aislar, y es el mismo criterio que `shouldFilter` (`lib/multistore/types.ts`).
 *
 * Vive acá y no en cada ruta porque `readSetting(key, undefined)` NO busca la fila
 * de la tienda: va derecho a la global (`modules/store-config/service.ts`). Una
 * ruta que escriba la config con la tienda activa y otra que la lea sin ella
 * guardan en un lugar y leen de otro, y el valor guardado se pierde sin ningún
 * error — precedente: `/generate` congelaba la config global mientras
 * `/config` guardaba la de la tienda.
 */
const siteOf = async (req) => {
    const resolution = await (0, request_1.siteFromRequest)(req);
    return resolution.status === 'site' ? resolution.site.id : null;
};
exports.siteOf = siteOf;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiX3NoYXJlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvYWRtaW4vY2F0YWxvZ2Fkb3IvX3NoYXJlZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSw2REFBa0U7QUFFbEU7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNJLE1BQU0sTUFBTSxHQUFHLEtBQUssRUFBRSxHQUFrQixFQUEwQixFQUFFO0lBQ3pFLE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzlDLE9BQU8sVUFBVSxDQUFDLE1BQU0sS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDbEUsQ0FBQyxDQUFDO0FBSFcsUUFBQSxNQUFNLFVBR2pCIn0=