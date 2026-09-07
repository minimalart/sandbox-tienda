"use strict";
/**
 * Barrel del shim multistore vendorizado para el plugin shop-by-looks.
 *
 * Se replica lo estrictamente consumido por el plugin (rutas admin + store,
 * descriptor de site-scope). El resto de la superficie del multistore del host
 * (`credentials`, `scoped-routes`, `store-routes`, tests) NO se importa acá — no
 * lo necesita ninguna ruta del plugin y su ausencia mantiene el bundle chico.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SITE_REGISTRY_TABLE = exports.SITE_REGISTRY_MODULE = exports.resolveSite = exports.SITE_SCOPE_MAX_IDS = exports.assertRowInSite = exports.siteDefaults = exports.siteColumnFilter = exports.siteFilter = exports.channelsFromPublishableKey = exports.siteIdFromPublishableKey = exports.siteFromPublishableKey = exports.ALL_SITES = exports.SITE_SLUG_HEADER = exports.SITE_ID_HEADER = exports.siteHintOf = exports.attachSiteHint = exports.siteFromRequest = void 0;
var request_1 = require("./request");
Object.defineProperty(exports, "siteFromRequest", { enumerable: true, get: function () { return request_1.siteFromRequest; } });
Object.defineProperty(exports, "attachSiteHint", { enumerable: true, get: function () { return request_1.attachSiteHint; } });
Object.defineProperty(exports, "siteHintOf", { enumerable: true, get: function () { return request_1.siteHintOf; } });
Object.defineProperty(exports, "SITE_ID_HEADER", { enumerable: true, get: function () { return request_1.SITE_ID_HEADER; } });
Object.defineProperty(exports, "SITE_SLUG_HEADER", { enumerable: true, get: function () { return request_1.SITE_SLUG_HEADER; } });
Object.defineProperty(exports, "ALL_SITES", { enumerable: true, get: function () { return request_1.ALL_SITES; } });
var publishable_key_1 = require("./publishable-key");
Object.defineProperty(exports, "siteFromPublishableKey", { enumerable: true, get: function () { return publishable_key_1.siteFromPublishableKey; } });
Object.defineProperty(exports, "siteIdFromPublishableKey", { enumerable: true, get: function () { return publishable_key_1.siteIdFromPublishableKey; } });
Object.defineProperty(exports, "channelsFromPublishableKey", { enumerable: true, get: function () { return publishable_key_1.channelsFromPublishableKey; } });
var scope_1 = require("./scope");
Object.defineProperty(exports, "siteFilter", { enumerable: true, get: function () { return scope_1.siteFilter; } });
Object.defineProperty(exports, "siteColumnFilter", { enumerable: true, get: function () { return scope_1.siteColumnFilter; } });
Object.defineProperty(exports, "siteDefaults", { enumerable: true, get: function () { return scope_1.siteDefaults; } });
Object.defineProperty(exports, "assertRowInSite", { enumerable: true, get: function () { return scope_1.assertRowInSite; } });
Object.defineProperty(exports, "SITE_SCOPE_MAX_IDS", { enumerable: true, get: function () { return scope_1.SITE_SCOPE_MAX_IDS; } });
var resolve_site_1 = require("./resolve-site");
Object.defineProperty(exports, "resolveSite", { enumerable: true, get: function () { return resolve_site_1.resolveSite; } });
var module_key_1 = require("./module-key");
Object.defineProperty(exports, "SITE_REGISTRY_MODULE", { enumerable: true, get: function () { return module_key_1.SITE_REGISTRY_MODULE; } });
Object.defineProperty(exports, "SITE_REGISTRY_TABLE", { enumerable: true, get: function () { return module_key_1.SITE_REGISTRY_TABLE; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL211bHRpc3RvcmUvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7O0dBT0c7OztBQUVILHFDQU9tQjtBQU5qQiwwR0FBQSxlQUFlLE9BQUE7QUFDZix5R0FBQSxjQUFjLE9BQUE7QUFDZCxxR0FBQSxVQUFVLE9BQUE7QUFDVix5R0FBQSxjQUFjLE9BQUE7QUFDZCwyR0FBQSxnQkFBZ0IsT0FBQTtBQUNoQixvR0FBQSxTQUFTLE9BQUE7QUFHWCxxREFJMkI7QUFIekIseUhBQUEsc0JBQXNCLE9BQUE7QUFDdEIsMkhBQUEsd0JBQXdCLE9BQUE7QUFDeEIsNkhBQUEsMEJBQTBCLE9BQUE7QUFHNUIsaUNBTWlCO0FBTGYsbUdBQUEsVUFBVSxPQUFBO0FBQ1YseUdBQUEsZ0JBQWdCLE9BQUE7QUFDaEIscUdBQUEsWUFBWSxPQUFBO0FBQ1osd0dBQUEsZUFBZSxPQUFBO0FBQ2YsMkdBQUEsa0JBQWtCLE9BQUE7QUFTcEIsK0NBQTZDO0FBQXBDLDJHQUFBLFdBQVcsT0FBQTtBQUlwQiwyQ0FBeUU7QUFBaEUsa0hBQUEsb0JBQW9CLE9BQUE7QUFBRSxpSEFBQSxtQkFBbUIsT0FBQSJ9