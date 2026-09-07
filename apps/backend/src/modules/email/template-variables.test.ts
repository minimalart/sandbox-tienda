import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { EMAIL_TEMPLATE_VARIABLES, variablesForKey } from './template-variables';

/**
 * El catálogo de variables tiene que cubrir las keys que el admin ofrece, porque
 * una key sin variables NO falla: pinta una pantalla vacía y el operador concluye
 * que la plantilla no tiene nada configurable.
 *
 * Las keys se leen del fuente de `admin/lib/email-events-catalog.ts` en vez de
 * importarlo: ese módulo es TSX-adjacent y arrastra el bundle del admin. Acá sólo
 * hace falta la lista de strings.
 */
const SRC = join(import.meta.dirname, '..', '..');

function catalogKeys(): string[] {
  const source = readFileSync(join(SRC, 'admin', 'lib', 'email-events-catalog.ts'), 'utf8');
  return [...source.matchAll(/\b(?:USER|ADMIN)\('([a-z0-9.-]+)'/g)].map((m) => m[1]);
}

/**
 * Keys del catálogo que NO tienen plantilla local, con el motivo. Es una lista
 * EXPLÍCITA a propósito: el default de este test es fallar, así que una key nueva
 * sin variables se cae en CI en vez de aparecer como pantalla vacía. Sumar una
 * key acá es una decisión, no un olvido.
 */
const SIN_PLANTILLA_LOCAL: Record<string, string> = {
  // Usan plantillas DINÁMICAS de SendGrid, identificadas por un ID de la cuenta:
  // el HTML no vive en este repo, así que no hay variables locales que declarar.
  'company-invite': 'plantilla dinámica de SendGrid (COMPANY_INVITE_SENDGRID_TEMPLATE_ID)',
  'corporate-invite': 'plantilla dinámica de SendGrid (CORPORATE_INVITE_SENDGRID_TEMPLATE_ID)',
  // Seleccionables en el admin pero sin entrada en el seed todavía.
  //
  // `gift-card-issued` SALIÓ de acá (2026-09-03) junto con su entrada del
  // catálogo: no era una key sin variables, era una key que NADIE EMITÍA. El
  // plugin de gift cards manda `gift-card-delivery`, `-resend`,
  // `-delivery-failed-buyer`, `-expiring` y `-balance-reminder`. Que la excepción
  // sobreviviera cinco versiones es justo lo que el test de abajo previene.
  'order-invoice': 'sin plantilla en el seed',
};

test('cada key del catálogo tiene variables declaradas, o una excepción con motivo', () => {
  const keys = catalogKeys();
  assert.ok(keys.length > 20, `esperaba las keys del catálogo, encontré ${keys.length}`);

  const huerfanas = keys.filter(
    (k) => !EMAIL_TEMPLATE_VARIABLES[k] && !(k in SIN_PLANTILLA_LOCAL),
  );
  assert.deepEqual(
    huerfanas,
    [],
    `estas keys no declaran variables y no están exceptuadas: ${huerfanas.join(', ')}. ` +
      'Sin variables, la pantalla del admin no muestra el editor y se ve como si la ' +
      'plantilla no tuviera nada configurable. Agregalas al catálogo o a SIN_PLANTILLA_LOCAL.',
  );
});

test('las excepciones siguen existiendo en el catálogo de eventos', () => {
  const keys = new Set(catalogKeys());
  const fantasmas = Object.keys(SIN_PLANTILLA_LOCAL).filter((k) => !keys.has(k));
  assert.deepEqual(
    fantasmas,
    [],
    `estas excepciones ya no son keys del catálogo: ${fantasmas.join(', ')}. ` +
      'Una excepción que sobrevive a su key tapa el próximo hueco real.',
  );
});

test('ninguna key exceptuada declara variables (la excepción sería mentira)', () => {
  const contradice = Object.keys(SIN_PLANTILLA_LOCAL).filter(
    (k) => EMAIL_TEMPLATE_VARIABLES[k],
  );
  assert.deepEqual(contradice, [], `exceptuadas pero con variables: ${contradice.join(', ')}`);
});

test('password-reset declara link_reseteo — es la variable del CTA', () => {
  const names = variablesForKey('password-reset').map((v) => v.name);
  assert.ok(
    names.includes('link_reseteo'),
    `password-reset sin link_reseteo; declara: ${names.join(', ')}`,
  );
});

test('toda variable tiene nombre no vacío y descripción', () => {
  for (const [key, vars] of Object.entries(EMAIL_TEMPLATE_VARIABLES)) {
    assert.ok(vars.length > 0, `${key} declara una lista vacía: es peor que no estar`);
    for (const v of vars) {
      assert.ok(v.name.trim().length > 0, `${key} tiene una variable sin nombre`);
      // La descripción es lo que el operador lee al lado del input. Sin ella el
      // formulario es una lista de nombres crudos y no resuelve nada.
      assert.ok(
        (v.description ?? '').trim().length > 0,
        `${key}.${v.name} no tiene descripción`,
      );
    }
  }
});

test('no hay variables duplicadas dentro de una plantilla', () => {
  for (const [key, vars] of Object.entries(EMAIL_TEMPLATE_VARIABLES)) {
    const names = vars.map((v) => v.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    assert.deepEqual(dupes, [], `${key} declara dos veces: ${dupes.join(', ')}`);
  }
});

test('variablesForKey degrada a [] y nunca revienta', () => {
  assert.deepEqual(variablesForKey('no-existe-esta-key'), []);
  assert.deepEqual(variablesForKey(''), []);
  assert.deepEqual(variablesForKey(undefined), []);
  assert.deepEqual(variablesForKey(null), []);
});

/**
 * El fallback sirve de algo sólo si la pantalla lo usa. Si alguien vuelve a
 * `template.variables ?? []` sin el catálogo, los otros tests siguen verdes y el
 * bug reaparece igual: la pantalla vacía. Por eso esto mira el fuente.
 */
test('la pantalla del admin usa el fallback del catálogo', () => {
  const page = readFileSync(
    join(SRC, 'admin', 'routes', 'email-templates', '[id]', 'page.tsx'),
    'utf8',
  );
  assert.ok(
    page.includes('variablesForKey'),
    'la pantalla ya no llama a variablesForKey: una fila sin variables vuelve a esconder el editor',
  );
});
