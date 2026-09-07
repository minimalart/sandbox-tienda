"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSendgridPublicKey = normalizeSendgridPublicKey;
exports.getGiftCardExperienceSettings = getGiftCardExperienceSettings;
const mercatto_plugin_runtime_1 = require("@minimalart/mercatto-plugin-runtime");
const readBool = (key, fallback) => {
    const valueFromHost = (0, mercatto_plugin_runtime_1.getAppSettingsSyncReader)()?.('extension:gift-cards', key);
    if (typeof valueFromHost === 'boolean')
        return valueFromHost;
    const raw = process.env[key];
    if (raw === undefined)
        return fallback;
    const value = raw.trim().toLowerCase();
    if (value === '')
        return fallback;
    if (value === 'true' || value === '1' || value === 'yes' || value === 'on')
        return true;
    if (value === 'false' || value === '0' || value === 'no' || value === 'off')
        return false;
    return fallback;
};
const readString = (key, fallback) => {
    const raw = (0, mercatto_plugin_runtime_1.getAppSettingsSyncReader)()?.('extension:gift-cards', key) ?? process.env[key];
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    return trimmed === '' ? fallback : trimmed;
};
/**
 * Normaliza la clave pública de SendGrid a un PEM que `crypto.verify()` acepte.
 *
 * SendGrid entrega la clave del Signed Event Webhook como **base64 SPKI en una
 * sola línea**, sin cabeceras. Node NO acepta ese formato: `verify()` tira
 * `DECODER routines::unsupported`, el `try/catch` de la ruta lo traga y el
 * webhook responde 401 para siempre — o sea, la integración parecía configurada
 * y nunca podía funcionar con el valor que SendGrid te da.
 *
 * Verificado con `crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })`:
 * PEM → `true`; base64 crudo → throw; PEM con `\n` literales (lo que pasa cuando
 * la clave viaja por un panel de deploy) → throw.
 *
 * La normalización es estrictamente aditiva: una clave que ya venía en PEM real
 * sigue funcionando igual.
 */
function normalizeSendgridPublicKey(raw) {
    const value = raw.trim();
    if (value === '')
        return '';
    // Un panel de deploy suele guardar el PEM con `\n` de dos caracteres.
    const unescaped = value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
    if (unescaped.includes('-----BEGIN'))
        return unescaped;
    // Base64 crudo (el formato que copia y pega el 99% de la gente): a PEM.
    const body = unescaped.replace(/\s+/g, '');
    const lines = body.match(/.{1,64}/g) ?? [body];
    return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----\n`;
}
function getGiftCardExperienceSettings() {
    return {
        experienceEnabled: readBool('GIFT_CARD_EXPERIENCE_ENABLED', false),
        sendgridEventPublicKey: normalizeSendgridPublicKey(readString('SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY', '')),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9naWZ0LWNhcmQtZXhwZXJpZW5jZS9zZXR0aW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQThDQSxnRUFZQztBQUVELHNFQU9DO0FBbkVELGlGQUErRTtBQVkvRSxNQUFNLFFBQVEsR0FBRyxDQUFDLEdBQVcsRUFBRSxRQUFpQixFQUFXLEVBQUU7SUFDM0QsTUFBTSxhQUFhLEdBQUcsSUFBQSxrREFBd0IsR0FBRSxFQUFFLENBQUMsc0JBQXNCLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDaEYsSUFBSSxPQUFPLGFBQWEsS0FBSyxTQUFTO1FBQUUsT0FBTyxhQUFhLENBQUM7SUFDN0QsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM3QixJQUFJLEdBQUcsS0FBSyxTQUFTO1FBQUUsT0FBTyxRQUFRLENBQUM7SUFDdkMsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ3ZDLElBQUksS0FBSyxLQUFLLEVBQUU7UUFBRSxPQUFPLFFBQVEsQ0FBQztJQUNsQyxJQUFJLEtBQUssS0FBSyxNQUFNLElBQUksS0FBSyxLQUFLLEdBQUcsSUFBSSxLQUFLLEtBQUssS0FBSyxJQUFJLEtBQUssS0FBSyxJQUFJO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDeEYsSUFBSSxLQUFLLEtBQUssT0FBTyxJQUFJLEtBQUssS0FBSyxHQUFHLElBQUksS0FBSyxLQUFLLElBQUksSUFBSSxLQUFLLEtBQUssS0FBSztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQzFGLE9BQU8sUUFBUSxDQUFDO0FBQ2xCLENBQUMsQ0FBQztBQUVGLE1BQU0sVUFBVSxHQUFHLENBQUMsR0FBVyxFQUFFLFFBQWdCLEVBQVUsRUFBRTtJQUMzRCxNQUFNLEdBQUcsR0FBRyxJQUFBLGtEQUF3QixHQUFFLEVBQUUsQ0FBQyxzQkFBc0IsRUFBRSxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzFGLE1BQU0sT0FBTyxHQUFHLE9BQU8sR0FBRyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDMUQsT0FBTyxPQUFPLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUM3QyxDQUFDLENBQUM7QUFFRjs7Ozs7Ozs7Ozs7Ozs7O0dBZUc7QUFDSCxTQUFnQiwwQkFBMEIsQ0FBQyxHQUFXO0lBQ3BELE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUN6QixJQUFJLEtBQUssS0FBSyxFQUFFO1FBQUUsT0FBTyxFQUFFLENBQUM7SUFFNUIsc0VBQXNFO0lBQ3RFLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7SUFDOUUsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQztRQUFFLE9BQU8sU0FBUyxDQUFDO0lBRXZELHdFQUF3RTtJQUN4RSxNQUFNLElBQUksR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztJQUMzQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDL0MsT0FBTywrQkFBK0IsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsOEJBQThCLENBQUM7QUFDdkYsQ0FBQztBQUVELFNBQWdCLDZCQUE2QjtJQUMzQyxPQUFPO1FBQ0wsaUJBQWlCLEVBQUUsUUFBUSxDQUFDLDhCQUE4QixFQUFFLEtBQUssQ0FBQztRQUNsRSxzQkFBc0IsRUFBRSwwQkFBMEIsQ0FDaEQsVUFBVSxDQUFDLG1DQUFtQyxFQUFFLEVBQUUsQ0FBQyxDQUNwRDtLQUNGLENBQUM7QUFDSixDQUFDIn0=