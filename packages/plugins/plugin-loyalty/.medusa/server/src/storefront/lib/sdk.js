"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sdk = void 0;
const js_sdk_1 = __importDefault(require("@medusajs/js-sdk"));
/**
 * Storefront-side SDK for the loyalty plugin's BFF routes.
 *
 * These routes run server-side inside the template's Next.js app, so
 * `NEXT_PUBLIC_MEDUSA_BACKEND_URL` and `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` are
 * baked into the build. Creating the SDK here (instead of importing the
 * template's `@lib/config` sdk) keeps the plugin usable in any storefront
 * without a specific path-alias convention.
 *
 * Defaults `http://localhost:9000` for local dev; production builds MUST set
 * `NEXT_PUBLIC_MEDUSA_BACKEND_URL`, otherwise every request hits localhost
 * inside the container and returns nothing.
 */
exports.sdk = new js_sdk_1.default({
    baseUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000',
    publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3N0b3JlZnJvbnQvbGliL3Nkay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSw4REFBc0M7QUFFdEM7Ozs7Ozs7Ozs7OztHQVlHO0FBQ1UsUUFBQSxHQUFHLEdBQUcsSUFBSSxnQkFBTSxDQUFDO0lBQzVCLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLDhCQUE4QixJQUFJLHVCQUF1QjtJQUM5RSxjQUFjLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0M7Q0FDL0QsQ0FBQyxDQUFDIn0=