import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La clave de una plantilla es única POR TIENDA, no por instancia.
 *
 * `ensureUniqueKey` miraba TODA la tabla, y era la mitad de ESCRITURA del bug de la
 * plantilla inalcanzable. El modelo declara dos índices únicos PARCIALES —uno para
 * `site_id IS NULL`, otro para `site_id IS NOT NULL`— justamente para que la tienda B
 * pueda tener su propia `password-reset` sin pisar la global. Con el chequeo global esa
 * segunda plantilla nacía con la clave `password-reset-2`, que NO es la clave que
 * `createNotifications` emite: quedaba guardada, publicada, y no se usaba nunca. El
 * operador la veía en el listado con un nombre casi idéntico y sin ninguna pista.
 *
 * Se verifica sobre el fuente porque el service extiende `MedusaService` y no se puede
 * importar sin container (mismo motivo que `site-branding.test.ts`).
 */

const HERE = import.meta.dirname;
const SERVICE = readFileSync(join(HERE, 'service.ts'), 'utf8');
const MODEL = readFileSync(join(HERE, 'models', 'email-template.ts'), 'utf8');
const CREATE_WF = readFileSync(join(HERE, '..', '..', 'workflows', 'create-email-template.ts'), 'utf8');
const UPDATE_WF = readFileSync(join(HERE, '..', '..', 'workflows', 'update-email-template.ts'), 'utf8');

test('el modelo permite la MISMA clave en tiendas distintas', () => {
  // Es la premisa del resto del archivo: si los índices fueran uno solo sobre `key`,
  // el chequeo global sería correcto y esto no tendría sentido.
  assert.match(MODEL, /unique: true, where: 'site_id IS NULL AND deleted_at IS NULL'/);
  assert.match(MODEL, /unique: true, where: 'site_id IS NOT NULL AND deleted_at IS NULL'/);
});

test('ensureUniqueKey pregunta por la clave DENTRO de la tienda', () => {
  const body = SERVICE.slice(SERVICE.indexOf('async ensureUniqueKey'));
  assert.match(
    body,
    /listEmailTemplates\(\{ key: candidate, site_id: siteId \}\)/,
    'sin `site_id` en el filtro, la plantilla de una tienda choca con la global y nace como `<clave>-2`',
  );
});

test('la tienda es un parámetro OBLIGATORIO, sin default de conveniencia', () => {
  // Un `siteId: string | null = null` haría que un call site olvidadizo compile y
  // compare contra las globales — el bug de vuelta, sin ninguna señal.
  const signature = SERVICE.slice(
    SERVICE.indexOf('async ensureUniqueKey'),
    SERVICE.indexOf('const normalized = this.generateKey(key)'),
  );
  assert.match(signature, /siteId: string \| null,/);
  assert.doesNotMatch(signature, /siteId: string \| null = null/);
});

test('el alta le pasa la tienda con la que la fila va a nacer', () => {
  assert.match(CREATE_WF, /ensureUniqueKey\(baseKey, undefined, siteId\)/);
  // Y la misma variable es la que se persiste: si fueran dos expresiones distintas, la
  // clave podría chequearse contra una tienda y guardarse en otra.
  assert.match(CREATE_WF, /const siteId = input\.site_id \?\? null;/);
  assert.match(CREATE_WF, /site_id: siteId,/);
});

test('la edición resuelve la tienda de la fila antes de chequear la clave', () => {
  const body = UPDATE_WF.slice(UPDATE_WF.indexOf('if (key !== undefined)'));
  assert.match(body, /rest\.site_id !== undefined/, 'un update que muda la fila tiene que chequear contra la tienda NUEVA');
  assert.match(body, /retrieveEmailTemplate\(id\)/, 'y si no la muda, contra la que la fila ya tiene');
  assert.match(body, /ensureUniqueKey\(key, id, siteId\)/);
});

test('el retrieve extra sólo corre cuando la clave cambia', () => {
  // Es una lectura por guardado si se sale del `if`. El 99% de los guardados son de
  // texto y no tocan la clave.
  const before = UPDATE_WF.slice(0, UPDATE_WF.indexOf('if (key !== undefined)'));
  assert.doesNotMatch(before, /retrieveEmailTemplate/);
});
