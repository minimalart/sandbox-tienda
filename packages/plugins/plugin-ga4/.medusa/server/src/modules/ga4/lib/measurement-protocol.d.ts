/** Config de GA4 necesaria para enviar por Measurement Protocol. La resuelve el
 * servicio (app-settings + fila legacy ga4_settings) y la pasa a las funciones
 * de envío. */
export type Ga4SendConfig = {
    measurementId: string;
    apiSecret: string;
    debug?: boolean;
};
export type SendGa4EventInput = {
    clientId: string;
    eventName: string;
    params: Record<string, unknown>;
    userId?: string;
    config: Ga4SendConfig;
};
export type SendGa4EventResult = {
    ok: boolean;
    status: number;
};
/**
 * Este archivo ya NO lee `process.env`. La configuración de GA4 la resuelve
 * `modules/ga4/settings.ts` con la precedencia DB > env > default de
 * `app-settings`, y el servicio la mezcla con la fila legacy `ga4_settings`.
 * Los alias de env (`NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_GTM_ID`) viven
 * ahora en el `env[]` de `app-settings/descriptors/ga4.ts`.
 */
/**
 * Cliente fino del Measurement Protocol de GA4. POSTea un único evento al
 * endpoint /mp/collect (o /debug/mp/collect cuando config.debug=true).
 *
 * Recibe la config (measurement id + api secret + debug) resuelta desde la DB.
 * Lanza si faltan las credenciales; el caller (dispatch) captura y no propaga.
 */
export declare function sendGa4Event({ clientId, eventName, params, userId, config, }: SendGa4EventInput): Promise<SendGa4EventResult>;
/** Un mensaje de validación que devuelve el endpoint /debug/mp/collect de GA4. */
export type Ga4ValidationMessage = {
    fieldPath?: string;
    description?: string;
    validationCode?: string;
};
export type ValidateGa4EventResult = {
    ok: boolean;
    status: number;
    /** Vacío = el evento es válido según GA4. */
    validationMessages: Ga4ValidationMessage[];
};
/**
 * Valida un evento contra el endpoint /debug/mp/collect de GA4 (SIEMPRE el
 * endpoint debug, independientemente de config.debug) y devuelve los
 * `validationMessages` de Google. Un array vacío = el evento es válido.
 *
 * Se usa para el botón "Enviar evento de prueba" del backoffice: le permite al
 * admin confirmar que la config (measurement id + api secret) y el payload son
 * correctos SIN registrar un hit real en la propiedad de GA4.
 */
export declare function validateGa4Event({ clientId, eventName, params, config, }: Omit<SendGa4EventInput, 'userId'>): Promise<ValidateGa4EventResult>;
