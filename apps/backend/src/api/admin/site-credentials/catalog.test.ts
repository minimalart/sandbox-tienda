import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CREDENTIAL_CATALOG, findIntegration } from './catalog';
import { UpsertSiteCredentialSchema } from './schemas';

/**
 * El catálogo tiene que coincidir con lo que los providers LEEN, no con lo que
 * alguien creyó recordar.
 *
 * Un `correo_argentino` acá donde el provider lee `correo-argentino` guardaría la
 * credencial en una fila que nadie consulta: la pantalla mostraría la cuenta
 * cargada y la tienda seguiría cotizando con la del entorno, sin un solo error.
 * Ese es el modo de falla que hay que hacer imposible, y por eso esto se verifica
 * contra el FUENTE — instanciar los providers necesita un container de Medusa.
 * Misma técnica que `provider-credentials.test.ts`.
 */

const BACKEND_SRC = join(import.meta.dirname, '..', '..', '..');

test('el catálogo no está vacío (guard contra falso verde)', () => {
  assert.ok(CREDENTIAL_CATALOG.length >= 3, 'el catálogo se vació: todo lo de abajo pasaría solo');
});

test('cada integración con lector usa el string EXACTO que el provider consulta', () => {
  for (const spec of CREDENTIAL_CATALOG) {
    if (!spec.reader) continue;
    const file = join(BACKEND_SRC, spec.reader.replace(/^src\//, ''));
    if (!existsSync(file)) continue; // la extensión puede no estar instalada

    const src = readFileSync(file, 'utf8');
    assert.match(
      src,
      new RegExp(`readSiteCredentialsViaSql[\\s\\S]{0,200}?'${spec.integration}'`),
      `'${spec.integration}' no aparece como el literal que ${spec.reader} le pasa a ` +
        `readSiteCredentialsViaSql. Si no coinciden, la credencial se guarda en una fila ` +
        `que nadie lee y la tienda sigue usando la cuenta del entorno.`
    );
  }
});

test('las claves del catálogo son las que el provider desestructura', () => {
  // El tipo genérico del call site ES el contrato. Una clave de más se guarda y no
  // se usa nunca; una de menos no se puede cargar desde el admin.
  const expected: Record<string, string[]> = {
    andreani: ['username', 'password', 'contract', 'clientCode'],
    // El CUIT viaja con el par aunque no sea un secreto: el certificado está
    // EMITIDO PARA UN CUIT, y poder cargar uno sin el otro deja el certificado de
    // un titular declarando ser otro. Ver `modules/arca/site-credentials.ts`.
    arca: ['certificateBase64', 'privateKeyBase64', 'cuitRepresentada'],
    // `agreement` se sumó con la migración a `app-settings`: es el acuerdo
    // comercial contra el que se factura cada envío, y sin poder cargarlo por
    // tienda la B despachaba contra el de la A aunque tuviera su propia API key.
    'correo-argentino': [
      'micorreoUser',
      'micorreoPassword',
      'apiKey',
      'agreement',
      'sellerId',
      'customerId',
    ],
    kapso: ['apiKey', 'baseUrl'],
  };

  for (const [integration, keys] of Object.entries(expected)) {
    const spec = findIntegration(integration);
    assert.ok(spec, `falta '${integration}' en el catálogo`);
    assert.deepEqual(
      spec!.keys.map((entry) => entry.key).sort(),
      [...keys].sort(),
      `las claves de '${integration}' no coinciden con el tipo del call site`
    );
  }
});

test('una integración sin lector explica QUÉ la bloquea', () => {
  // Mismo criterio que los `pending` de `scoped-routes.ts`: sin la razón escrita,
  // "todavía no" se lee como "falta trabajo" y alguien lo arranca sin saber que
  // primero hay que resolver algo de afuera.
  const vagas = CREDENTIAL_CATALOG.filter(
    (spec) => !spec.reader && !spec.blockedReason?.startsWith('BLOQUEADA')
  ).map((spec) => spec.integration);
  assert.deepEqual(vagas, [], `sin razón escrita: ${vagas.join(', ')}`);
});

test('toda integración declara al menos una var de entorno de fallback', () => {
  // `envKeys` es lo que hace que el GET pueda decir "hoy esto sale del entorno".
  // Sin eso, una tienda sin credencial propia se vería igual que una integración
  // apagada, y son cosas muy distintas.
  for (const spec of CREDENTIAL_CATALOG) {
    assert.ok(spec.envKeys.length > 0, `'${spec.integration}' no declara envKeys`);
  }
});

// ── validación del POST ──────────────────────────────────────────────────────

const parse = (body: unknown) => UpsertSiteCredentialSchema.safeParse(body);

test('acepta un upsert normal', () => {
  assert.equal(parse({ integration: 'kapso', set: { apiKey: 'k-1' } }).success, true);
});

test('ARCA can no longer be saved as a company credential', () => {
  assert.equal(
    parse({ integration: 'arca', set: { cuitRepresentada: '20333333334' } }).success,
    false
  );
  assert.match(findIntegration('arca')!.blockedReason!, /Globales/);
});

test('rechaza una integración que todavía no tiene lector', () => {
  // Guardar un secreto que nada consume no adelanta trabajo: deja una pantalla que
  // miente, con el operador viendo la cuenta cargada mientras el checkout cobra en
  // la global.
  const r = parse({ integration: 'mercadopago', set: { accessToken: 'APP_USR-x' } });
  assert.equal(r.success, false);
  assert.match(JSON.stringify(r.error?.issues), /no lee de site_credential/);
});

test('rechaza una clave que el provider no lee', () => {
  // `apikey` en vez de `apiKey` se guardaría prolijo y no haría absolutamente nada.
  const r = parse({ integration: 'kapso', set: { apikey: 'k-1' } });
  assert.equal(r.success, false);
  assert.match(JSON.stringify(r.error?.issues), /Claves desconocidas/);
});

test('`unset` SÍ acepta claves fuera del catálogo', () => {
  // Es la única forma de limpiar basura de los INSERT a mano, que fueron el único
  // modo de cargar credenciales hasta que existió esta ruta.
  assert.equal(parse({ integration: 'kapso', unset: ['legacy_token'] }).success, true);
});

test('rechaza un body sin nada que hacer', () => {
  assert.equal(parse({ integration: 'kapso' }).success, false);
  assert.equal(parse({ integration: 'kapso', set: {}, unset: [] }).success, false);
});

test('rechaza la misma clave en `set` y en `unset`', () => {
  const r = parse({ integration: 'kapso', set: { apiKey: 'x' }, unset: ['apiKey'] });
  assert.equal(r.success, false);
  assert.match(JSON.stringify(r.error?.issues), /contradictorio/);
});

test('un valor vacío pasa la validación: lo ignora el merge, no el schema', () => {
  // El vacío es "no toqué el campo enmascarado". Rechazarlo acá obligaría a la UI a
  // limpiar el body y cualquier olvido dejaría un 400 incomprensible.
  assert.equal(parse({ integration: 'kapso', set: { apiKey: '' } }).success, true);
});

test('rechaza campos de más en el body', () => {
  assert.equal(
    parse({ integration: 'kapso', set: { apiKey: 'x' }, site_id: 'demo_norte' }).success,
    false
  );
});

test('el site_id NO se puede mandar por body', () => {
  // La tienda sale de `siteFromRequest`. Si viajara en el body, cualquiera podría
  // escribirle las credenciales a otra tienda desde la pantalla de la suya.
  const r = parse({ integration: 'kapso', set: { apiKey: 'x' }, site_id: 'demo_sur' });
  assert.equal(r.success, false);
});
