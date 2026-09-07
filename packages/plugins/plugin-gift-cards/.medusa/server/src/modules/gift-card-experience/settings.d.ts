/** Instance deployment switch and webhook key from the host snapshot.
 * Per-store business settings remain in gift_card_settings. */
export type GiftCardExperienceSettings = {
    /** Interruptor general del entorno. Se combina con AND contra `settings.enabled`. */
    experienceEnabled: boolean;
    /** Clave pública del webhook de SendGrid, ya normalizada a PEM. `''` si no hay. */
    sendgridEventPublicKey: string;
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
export declare function normalizeSendgridPublicKey(raw: string): string;
export declare function getGiftCardExperienceSettings(): GiftCardExperienceSettings;
