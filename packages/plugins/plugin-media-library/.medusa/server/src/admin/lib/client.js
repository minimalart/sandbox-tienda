"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sdk = void 0;
const js_sdk_1 = __importDefault(require("@medusajs/js-sdk"));
/**
 * SDK del backoffice local del plugin. media-library no es multi-tenant, así
 * que este cliente NO propaga headers de site scope; usa la sesión estándar del
 * admin. Si el host tiene su propio cliente con site-scope (multistore),
 * corre en paralelo — cada widget usa el suyo.
 */
exports.sdk = new js_sdk_1.default({
    baseUrl: '/',
    auth: {
        type: 'session',
    },
});
