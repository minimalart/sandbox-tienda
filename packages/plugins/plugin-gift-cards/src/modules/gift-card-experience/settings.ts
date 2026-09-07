import { getAppSettingsSyncReader } from '@minimalart/mercatto-plugin-runtime';

/** Instance deployment switch and webhook key from the host snapshot.
 * Per-store business settings remain in gift_card_settings. */

export type GiftCardExperienceSettings = {
  /** Interruptor general del entorno. Se combina con AND contra `settings.enabled`. */
  experienceEnabled: boolean;
  /** Clave pública del webhook de SendGrid, ya normalizada a PEM. `''` si no hay. */
  sendgridEventPublicKey: string;
};

const readBool = (key: string, fallback: boolean): boolean => {
  const valueFromHost = getAppSettingsSyncReader()?.('extension:gift-cards', key);
  if (typeof valueFromHost === 'boolean') return valueFromHost;
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === '') return fallback;
  if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  return fallback;
};

const readString = (key: string, fallback: string): string => {
  const raw = getAppSettingsSyncReader()?.('extension:gift-cards', key) ?? process.env[key];
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
export function normalizeSendgridPublicKey(raw: string): string {
  const value = raw.trim();
  if (value === '') return '';

  // Un panel de deploy suele guardar el PEM con `\n` de dos caracteres.
  const unescaped = value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
  if (unescaped.includes('-----BEGIN')) return unescaped;

  // Base64 crudo (el formato que copia y pega el 99% de la gente): a PEM.
  const body = unescaped.replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g) ?? [body];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----\n`;
}

export function getGiftCardExperienceSettings(): GiftCardExperienceSettings {
  return {
    experienceEnabled: readBool('GIFT_CARD_EXPERIENCE_ENABLED', false),
    sendgridEventPublicKey: normalizeSendgridPublicKey(
      readString('SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY', '')
    ),
  };
}
