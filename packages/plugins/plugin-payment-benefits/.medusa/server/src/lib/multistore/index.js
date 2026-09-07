"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SITE_SCOPE_MAX_IDS = exports.pickBySitePrecedence = exports.assertIdInSite = exports.assertRowInSite = exports.siteDefaults = exports.siteColumnFilter = exports.siteChannelFilter = exports.siteFilter = exports.UNKNOWN_SITE_ERROR_CODE = exports.shouldFilter = exports.channelsFromPublishableKey = exports.siteIdFromPublishableKey = exports.siteFromPublishableKey = exports.ALL_SITES = exports.SITE_SLUG_HEADER = exports.SITE_ID_HEADER = exports.siteHintOf = exports.siteFromRequest = exports.attachSiteHint = exports.toSiteRef = exports.siteIdOfChannel = exports.listSites = exports.resolveSite = exports.SITE_REGISTRY_TABLE = exports.SITE_REGISTRY_MODULE = void 0;
/**
 * Seam multitienda — superficie pública, vendorizada en este plugin.
 *
 * Este archivo es un espejo REDUCIDO de `apps/backend/src/lib/multistore/index.ts`:
 * solo re-exporta las piezas que consumen los handlers de este plugin. Vendorizarlas
 * al lado del código que las usa evita que un import cuelgue del host cuando el
 * plugin se instala en un proyecto de cliente (`resolve-ownership.js` NO copia
 * `src/lib/multistore/` a proyectos de cliente si no hay extensiones que lo
 * pidan — el plugin no es una extensión, es una dependencia npm).
 *
 * Convergencia futura: los plugins Tier A comparten esta superficie; cuando exista
 * `@minimalart/mercatto-plugin-runtime`, esta capa se reemplaza por un import de
 * runtime y estos archivos se borran.
 */
var module_key_1 = require("./module-key");
Object.defineProperty(exports, "SITE_REGISTRY_MODULE", { enumerable: true, get: function () { return module_key_1.SITE_REGISTRY_MODULE; } });
Object.defineProperty(exports, "SITE_REGISTRY_TABLE", { enumerable: true, get: function () { return module_key_1.SITE_REGISTRY_TABLE; } });
var resolve_site_1 = require("./resolve-site");
Object.defineProperty(exports, "resolveSite", { enumerable: true, get: function () { return resolve_site_1.resolveSite; } });
Object.defineProperty(exports, "listSites", { enumerable: true, get: function () { return resolve_site_1.listSites; } });
Object.defineProperty(exports, "siteIdOfChannel", { enumerable: true, get: function () { return resolve_site_1.siteIdOfChannel; } });
Object.defineProperty(exports, "toSiteRef", { enumerable: true, get: function () { return resolve_site_1.toSiteRef; } });
var request_1 = require("./request");
Object.defineProperty(exports, "attachSiteHint", { enumerable: true, get: function () { return request_1.attachSiteHint; } });
Object.defineProperty(exports, "siteFromRequest", { enumerable: true, get: function () { return request_1.siteFromRequest; } });
Object.defineProperty(exports, "siteHintOf", { enumerable: true, get: function () { return request_1.siteHintOf; } });
Object.defineProperty(exports, "SITE_ID_HEADER", { enumerable: true, get: function () { return request_1.SITE_ID_HEADER; } });
Object.defineProperty(exports, "SITE_SLUG_HEADER", { enumerable: true, get: function () { return request_1.SITE_SLUG_HEADER; } });
Object.defineProperty(exports, "ALL_SITES", { enumerable: true, get: function () { return request_1.ALL_SITES; } });
var publishable_key_1 = require("./publishable-key");
Object.defineProperty(exports, "siteFromPublishableKey", { enumerable: true, get: function () { return publishable_key_1.siteFromPublishableKey; } });
Object.defineProperty(exports, "siteIdFromPublishableKey", { enumerable: true, get: function () { return publishable_key_1.siteIdFromPublishableKey; } });
Object.defineProperty(exports, "channelsFromPublishableKey", { enumerable: true, get: function () { return publishable_key_1.channelsFromPublishableKey; } });
var types_1 = require("./types");
Object.defineProperty(exports, "shouldFilter", { enumerable: true, get: function () { return types_1.shouldFilter; } });
Object.defineProperty(exports, "UNKNOWN_SITE_ERROR_CODE", { enumerable: true, get: function () { return types_1.UNKNOWN_SITE_ERROR_CODE; } });
var scope_1 = require("./scope");
Object.defineProperty(exports, "siteFilter", { enumerable: true, get: function () { return scope_1.siteFilter; } });
Object.defineProperty(exports, "siteChannelFilter", { enumerable: true, get: function () { return scope_1.siteChannelFilter; } });
Object.defineProperty(exports, "siteColumnFilter", { enumerable: true, get: function () { return scope_1.siteColumnFilter; } });
Object.defineProperty(exports, "siteDefaults", { enumerable: true, get: function () { return scope_1.siteDefaults; } });
Object.defineProperty(exports, "assertRowInSite", { enumerable: true, get: function () { return scope_1.assertRowInSite; } });
Object.defineProperty(exports, "assertIdInSite", { enumerable: true, get: function () { return scope_1.assertIdInSite; } });
Object.defineProperty(exports, "pickBySitePrecedence", { enumerable: true, get: function () { return scope_1.pickBySitePrecedence; } });
Object.defineProperty(exports, "SITE_SCOPE_MAX_IDS", { enumerable: true, get: function () { return scope_1.SITE_SCOPE_MAX_IDS; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL211bHRpc3RvcmUvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILDJDQUF5RTtBQUFoRSxrSEFBQSxvQkFBb0IsT0FBQTtBQUFFLGlIQUFBLG1CQUFtQixPQUFBO0FBQ2xELCtDQUFvRjtBQUEzRSwyR0FBQSxXQUFXLE9BQUE7QUFBRSx5R0FBQSxTQUFTLE9BQUE7QUFBRSwrR0FBQSxlQUFlLE9BQUE7QUFBRSx5R0FBQSxTQUFTLE9BQUE7QUFDM0QscUNBT21CO0FBTmpCLHlHQUFBLGNBQWMsT0FBQTtBQUNkLDBHQUFBLGVBQWUsT0FBQTtBQUNmLHFHQUFBLFVBQVUsT0FBQTtBQUNWLHlHQUFBLGNBQWMsT0FBQTtBQUNkLDJHQUFBLGdCQUFnQixPQUFBO0FBQ2hCLG9HQUFBLFNBQVMsT0FBQTtBQUVYLHFEQUkyQjtBQUh6Qix5SEFBQSxzQkFBc0IsT0FBQTtBQUN0QiwySEFBQSx3QkFBd0IsT0FBQTtBQUN4Qiw2SEFBQSwwQkFBMEIsT0FBQTtBQUU1QixpQ0FBZ0U7QUFBdkQscUdBQUEsWUFBWSxPQUFBO0FBQUUsZ0hBQUEsdUJBQXVCLE9BQUE7QUFDOUMsaUNBVWlCO0FBVGYsbUdBQUEsVUFBVSxPQUFBO0FBQ1YsMEdBQUEsaUJBQWlCLE9BQUE7QUFDakIseUdBQUEsZ0JBQWdCLE9BQUE7QUFDaEIscUdBQUEsWUFBWSxPQUFBO0FBQ1osd0dBQUEsZUFBZSxPQUFBO0FBQ2YsdUdBQUEsY0FBYyxPQUFBO0FBQ2QsNkdBQUEsb0JBQW9CLE9BQUE7QUFFcEIsMkdBQUEsa0JBQWtCLE9BQUEifQ==