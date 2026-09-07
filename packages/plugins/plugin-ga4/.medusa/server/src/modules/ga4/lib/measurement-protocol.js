"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendGa4Event = sendGa4Event;
exports.validateGa4Event = validateGa4Event;
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
async function sendGa4Event({ clientId, eventName, params, userId, config, }) {
    const { measurementId, apiSecret, debug } = config;
    if (!measurementId || !apiSecret) {
        throw new Error('GA4 measurement protocol misconfigured: measurement_id and api_secret are required');
    }
    const base = debug
        ? 'https://www.google-analytics.com/debug/mp/collect'
        : 'https://www.google-analytics.com/mp/collect';
    const url = `${base}?measurement_id=${measurementId}&api_secret=${apiSecret}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: clientId,
            ...(userId ? { user_id: userId } : {}),
            events: [
                {
                    name: eventName,
                    params,
                },
            ],
        }),
    });
    return { ok: response.ok, status: response.status };
}
/**
 * Valida un evento contra el endpoint /debug/mp/collect de GA4 (SIEMPRE el
 * endpoint debug, independientemente de config.debug) y devuelve los
 * `validationMessages` de Google. Un array vacío = el evento es válido.
 *
 * Se usa para el botón "Enviar evento de prueba" del backoffice: le permite al
 * admin confirmar que la config (measurement id + api secret) y el payload son
 * correctos SIN registrar un hit real en la propiedad de GA4.
 */
async function validateGa4Event({ clientId, eventName, params, config, }) {
    const { measurementId, apiSecret } = config;
    if (!measurementId || !apiSecret) {
        throw new Error('GA4 measurement protocol misconfigured: measurement_id and api_secret are required');
    }
    const url = `https://www.google-analytics.com/debug/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: clientId,
            events: [{ name: eventName, params }],
        }),
    });
    let validationMessages = [];
    try {
        const body = (await response.json());
        validationMessages = body?.validationMessages ?? [];
    }
    catch {
        // El endpoint debug siempre responde JSON; si no, tratamos como sin mensajes.
    }
    return { ok: response.ok, status: response.status, validationMessages };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVhc3VyZW1lbnQtcHJvdG9jb2wuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9nYTQvbGliL21lYXN1cmVtZW50LXByb3RvY29sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBcUNBLG9DQXVDQztBQXlCRCw0Q0FvQ0M7QUFuSEQ7Ozs7OztHQU1HO0FBRUg7Ozs7OztHQU1HO0FBQ0ksS0FBSyxVQUFVLFlBQVksQ0FBQyxFQUNqQyxRQUFRLEVBQ1IsU0FBUyxFQUNULE1BQU0sRUFDTixNQUFNLEVBQ04sTUFBTSxHQUNZO0lBQ2xCLE1BQU0sRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxHQUFHLE1BQU0sQ0FBQztJQUVuRCxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDakMsTUFBTSxJQUFJLEtBQUssQ0FDYixvRkFBb0YsQ0FDckYsQ0FBQztJQUNKLENBQUM7SUFFRCxNQUFNLElBQUksR0FBRyxLQUFLO1FBQ2hCLENBQUMsQ0FBQyxtREFBbUQ7UUFDckQsQ0FBQyxDQUFDLDZDQUE2QyxDQUFDO0lBRWxELE1BQU0sR0FBRyxHQUFHLEdBQUcsSUFBSSxtQkFBbUIsYUFBYSxlQUFlLFNBQVMsRUFBRSxDQUFDO0lBRTlFLE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsRUFBRTtRQUNoQyxNQUFNLEVBQUUsTUFBTTtRQUNkLE9BQU8sRUFBRTtZQUNQLGNBQWMsRUFBRSxrQkFBa0I7U0FDbkM7UUFDRCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUNuQixTQUFTLEVBQUUsUUFBUTtZQUNuQixHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sRUFBRTtnQkFDTjtvQkFDRSxJQUFJLEVBQUUsU0FBUztvQkFDZixNQUFNO2lCQUNQO2FBQ0Y7U0FDRixDQUFDO0tBQ0gsQ0FBQyxDQUFDO0lBRUgsT0FBTyxFQUFFLEVBQUUsRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDdEQsQ0FBQztBQWdCRDs7Ozs7Ozs7R0FRRztBQUNJLEtBQUssVUFBVSxnQkFBZ0IsQ0FBQyxFQUNyQyxRQUFRLEVBQ1IsU0FBUyxFQUNULE1BQU0sRUFDTixNQUFNLEdBQzRCO0lBQ2xDLE1BQU0sRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLEdBQUcsTUFBTSxDQUFDO0lBRTVDLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUNqQyxNQUFNLElBQUksS0FBSyxDQUNiLG9GQUFvRixDQUNyRixDQUFDO0lBQ0osQ0FBQztJQUVELE1BQU0sR0FBRyxHQUFHLG9FQUFvRSxhQUFhLGVBQWUsU0FBUyxFQUFFLENBQUM7SUFFeEgsTUFBTSxRQUFRLEdBQUcsTUFBTSxLQUFLLENBQUMsR0FBRyxFQUFFO1FBQ2hDLE1BQU0sRUFBRSxNQUFNO1FBQ2QsT0FBTyxFQUFFO1lBQ1AsY0FBYyxFQUFFLGtCQUFrQjtTQUNuQztRQUNELElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO1lBQ25CLFNBQVMsRUFBRSxRQUFRO1lBQ25CLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsQ0FBQztTQUN0QyxDQUFDO0tBQ0gsQ0FBQyxDQUFDO0lBRUgsSUFBSSxrQkFBa0IsR0FBMkIsRUFBRSxDQUFDO0lBQ3BELElBQUksQ0FBQztRQUNILE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQW9ELENBQUM7UUFDeEYsa0JBQWtCLEdBQUcsSUFBSSxFQUFFLGtCQUFrQixJQUFJLEVBQUUsQ0FBQztJQUN0RCxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1AsOEVBQThFO0lBQ2hGLENBQUM7SUFFRCxPQUFPLEVBQUUsRUFBRSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQztBQUMxRSxDQUFDIn0=