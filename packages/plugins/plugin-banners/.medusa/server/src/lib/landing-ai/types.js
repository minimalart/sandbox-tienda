"use strict";
/**
 * Subset del `landing-page/ai/types` vendorizado en este plugin.
 *
 * Sólo se necesita `LandingAiError` para las rutas AI de banners
 * (ai-generate, ai-image, ai-compose). El resto de tipos del archivo original
 * (GenerateLandingInput, LandingSeo, PuckData, etc.) son propios de landings y
 * no aplican acá — se dejaron afuera a propósito para no arrastrar
 * `puck-schema.ts` ni la dep de Puck.
 *
 * Si banner en el futuro necesita más tipos, o (a) los vendorizamos también, o
 * (b) los exportamos desde `@minimalart/mercatto-plugin-landing-pages` y
 * consumimos por paquete.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LandingAiError = void 0;
/** Error tipado para que las rutas devuelvan el status correcto. */
class LandingAiError extends Error {
    status;
    constructor(message, status = 500) {
        super(message);
        this.name = 'LandingAiError';
        this.status = status;
    }
}
exports.LandingAiError = LandingAiError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2xhbmRpbmctYWkvdHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7R0FZRzs7O0FBRUgsb0VBQW9FO0FBQ3BFLE1BQWEsY0FBZSxTQUFRLEtBQUs7SUFDdkMsTUFBTSxDQUFTO0lBQ2YsWUFBWSxPQUFlLEVBQUUsTUFBTSxHQUFHLEdBQUc7UUFDdkMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLElBQUksR0FBRyxnQkFBZ0IsQ0FBQztRQUM3QixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUN2QixDQUFDO0NBQ0Y7QUFQRCx3Q0FPQyJ9