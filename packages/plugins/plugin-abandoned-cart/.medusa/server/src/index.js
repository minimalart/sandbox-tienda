"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbandonedCartModule = exports.ABANDONED_CART_MODULE = void 0;
var abandoned_cart_1 = require("./modules/abandoned-cart");
Object.defineProperty(exports, "ABANDONED_CART_MODULE", { enumerable: true, get: function () { return abandoned_cart_1.ABANDONED_CART_MODULE; } });
var abandoned_cart_2 = require("./modules/abandoned-cart");
Object.defineProperty(exports, "AbandonedCartModule", { enumerable: true, get: function () { return __importDefault(abandoned_cart_2).default; } });
/**
 * Este plugin NO expone setters propios. La coordinación con el host se
 * resuelve vía `@minimalart/mercatto-plugin-runtime`:
 *
 * - App-settings del namespace `extension:abandoned-cart` → el plugin lee con
 *   `getAppSettingsSyncReader()`.
 * - Templates de WhatsApp desde `kapso-whatsapp/settings` → el plugin lee con
 *   `getExternalReader(EXTERNAL_KEYS.KAPSO_WHATSAPP_SETTINGS)`.
 *
 * El host registra ambos una vez al arrancar. Sin bridge, el plugin cae a
 * `process.env` — misma semántica que la extensión con snapshot vacío.
 */
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsMkRBQWlFO0FBQXhELHVIQUFBLHFCQUFxQixPQUFBO0FBQzlCLDJEQUEwRTtBQUFqRSxzSUFBQSxPQUFPLE9BQXVCO0FBR3ZDOzs7Ozs7Ozs7OztHQVdHIn0=