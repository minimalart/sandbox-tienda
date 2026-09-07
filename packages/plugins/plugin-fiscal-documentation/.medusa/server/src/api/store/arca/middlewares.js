"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeArcaMiddlewares = void 0;
const framework_1 = require("@medusajs/framework");
const rate_limit_1 = require("./rate-limit");
const validators_1 = require("./taxpayer-lookup/validators");
/**
 * Middlewares de las rutas store de ARCA. Registrados desde
 * src/api/extension-middlewares.ts. Sin authenticate: el checkout soporta
 * guest y la publishable key ya se exige por default en /store/*.
 */
exports.storeArcaMiddlewares = [
    {
        matcher: '/store/arca/taxpayer-lookup',
        method: 'POST',
        // El rate limit corre primero: bajo abuso ni se parsea/valida el body.
        middlewares: [rate_limit_1.arcaRateLimit, (0, framework_1.validateAndTransformBody)(validators_1.PostArcaTaxpayerLookup)],
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2FyY2EvbWlkZGxld2FyZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbURBQXFGO0FBQ3JGLDZDQUE2QztBQUM3Qyw2REFBc0U7QUFFdEU7Ozs7R0FJRztBQUNVLFFBQUEsb0JBQW9CLEdBQXNCO0lBQ3JEO1FBQ0UsT0FBTyxFQUFFLDZCQUE2QjtRQUN0QyxNQUFNLEVBQUUsTUFBTTtRQUNkLHVFQUF1RTtRQUN2RSxXQUFXLEVBQUUsQ0FBQywwQkFBYSxFQUFFLElBQUEsb0NBQXdCLEVBQUMsbUNBQXNCLENBQUMsQ0FBQztLQUMvRTtDQUNGLENBQUMifQ==