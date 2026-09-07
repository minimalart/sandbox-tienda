"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ga4Module = exports.GA4_MODULE = void 0;
var ga4_1 = require("./modules/ga4");
Object.defineProperty(exports, "GA4_MODULE", { enumerable: true, get: function () { return ga4_1.GA4_MODULE; } });
var ga4_2 = require("./modules/ga4");
Object.defineProperty(exports, "Ga4Module", { enumerable: true, get: function () { return __importDefault(ga4_2).default; } });
/**
 * Este plugin NO expone setters propios. La coordinación con el host se
 * resuelve vía `@minimalart/mercatto-plugin-runtime`:
 *
 * - App-settings del namespace `extension:ga4` → el plugin lee con
 *   `getAppSettingsSyncReader()`.
 *
 * El host registra el reader una vez al arrancar. Sin bridge, el plugin cae a
 * `process.env` — misma semántica que la extensión con snapshot vacío.
 */
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEscUNBQTJDO0FBQWxDLGlHQUFBLFVBQVUsT0FBQTtBQUNuQixxQ0FBcUQ7QUFBNUMsaUhBQUEsT0FBTyxPQUFhO0FBRTdCOzs7Ozs7Ozs7R0FTRyJ9