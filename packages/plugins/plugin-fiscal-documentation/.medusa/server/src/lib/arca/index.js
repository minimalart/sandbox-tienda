"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// ARCA no es un módulo Medusa: es un cliente WSAA + padrón A5 de AFIP
// usado por el módulo `fiscal-documentation` (para generar facturas A) y
// por la ruta store `/store/arca/taxpayer-lookup` (autocomplete de CUIT).
//
// El plugin loader de Medusa 2.18 auto-descubre `src/modules/*/index.ts`
// esperando un `Module()` registration. Este archivo existe para que ese
// scan no tire ENOENT sobre `modules/arca/index.js` — no registra un
// módulo, solo re-exporta el resto del namespace como una librería.
__exportStar(require("./config"), exports);
__exportStar(require("./constancia"), exports);
__exportStar(require("./fixtures"), exports);
__exportStar(require("./lookup"), exports);
__exportStar(require("./mapper"), exports);
__exportStar(require("./settings"), exports);
__exportStar(require("./site-credentials"), exports);
__exportStar(require("./types"), exports);
__exportStar(require("./wsaa"), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2FyY2EvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHNFQUFzRTtBQUN0RSx5RUFBeUU7QUFDekUsMEVBQTBFO0FBQzFFLEVBQUU7QUFDRix5RUFBeUU7QUFDekUseUVBQXlFO0FBQ3pFLHFFQUFxRTtBQUNyRSxvRUFBb0U7QUFDcEUsMkNBQXlCO0FBQ3pCLCtDQUE2QjtBQUM3Qiw2Q0FBMkI7QUFDM0IsMkNBQXlCO0FBQ3pCLDJDQUF5QjtBQUN6Qiw2Q0FBMkI7QUFDM0IscURBQW1DO0FBQ25DLDBDQUF3QjtBQUN4Qix5Q0FBdUIifQ==