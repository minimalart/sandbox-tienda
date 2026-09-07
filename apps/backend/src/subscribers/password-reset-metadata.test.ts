import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `auth.password_reset` SÍ trae la tienda, y durante meses se tiró.
 *
 * El payload lo arma `generateResetPasswordTokenWorkflow` (core-flows) con cuatro
 * campos: `{ entity_id, actor_type, token, metadata }`. El cuarto lo copia la ruta del
 * core del body del reseteo, y el storefront ya manda ahí
 * `{ sales_channel_id, country_code, web_url }`. Los dos subscribers destructuraban
 * los tres primeros y nada más.
 *
 * La consecuencia no era un error: era un mail con el branding y la plantilla de la
 * tienda equivocada y un link al dominio de otra. Nada en el log.
 *
 * Se verifica sobre el fuente porque instanciar un subscriber necesita un container.
 */

const SUBSCRIBERS = ['password-reset-email.ts', 'password-reset-whatsapp.ts'];

for (const file of SUBSCRIBERS) {
  const source = readFileSync(join(import.meta.dirname, file), 'utf8');

  test(`${file} declara y lee \`metadata\` del evento`, () => {
    assert.match(source, /metadata\?: Record<string, unknown>/, 'no la declara en el tipo');
    assert.match(source, /const \{[^}]*metadata[^}]*\} = event\.data/, 'no la destructura');
  });

  test(`${file} reenvía \`sales_channel_id\` en la data de la notificación`, () => {
    // Es una de las dos formas que los providers de mail y WhatsApp aceptan para
    // resolver la tienda. Sin esto vuelven a depender de la tienda implícita, que con
    // más de una tienda es `null` a propósito.
    assert.match(source, /sales_channel_id: salesChannelId/);
    // Y sólo cuando de verdad viene: un `sales_channel_id: undefined` en la data haría
    // que el provider lo lea como presente y no caiga al implícito.
    assert.match(source, /typeof salesChannelId === 'string' && salesChannelId/);
  });

  test(`${file} arma el link por el helper con allowlist`, () => {
    // Nunca a mano: `web_url` sale del header `Origin` del browser. Ver `lib/reset-link.ts`.
    assert.match(source, /resolveStorefrontBase\(metadata\?\.web_url/);
    assert.match(source, /buildResetLink\(/);
    assert.doesNotMatch(
      source,
      /`\$\{[^}]*\}\/reset-password\?token=/,
      'arma el link a mano: se saltea el allowlist',
    );
  });
}
