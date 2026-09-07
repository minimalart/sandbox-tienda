import { type MiddlewareRoute } from '@medusajs/framework';
/**
 * Middlewares de las rutas store de ARCA. Registrados desde
 * src/api/extension-middlewares.ts. Sin authenticate: el checkout soporta
 * guest y la publishable key ya se exige por default en /store/*.
 */
export declare const storeArcaMiddlewares: MiddlewareRoute[];
