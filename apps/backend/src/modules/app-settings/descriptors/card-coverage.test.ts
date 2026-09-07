import { isCredentialSetting } from '../credential-presentation';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { findNamespace, settingsNamespaces } from './index.ts';

/**
 * Un descriptor sin card es un ajuste INVISIBLE, que es la falla exacta que toda
 * esta migración vino a matar. Y la variante peor no es la card que falta entera
 * —esa se nota— sino la extensión grande repartida en varias cards por `groups`,
 * donde alguien agrega un `group` nuevo a un descriptor y ninguna card lo nombra.
 * El ajuste existe, la API lo devuelve, el buscador central lo encuentra, y en la
 * pantalla de la extensión no está. Nadie se entera hasta que un cliente pregunta
 * por qué no puede cambiar algo que el changelog dice que se puede cambiar.
 *
 * Esto ya se verificó UNA vez a mano, con un script descartable para las dos
 * carriers. El script tenía un bug —cortaba el archivo en el `string[];` de una
 * anotación de tipo y comparaba contra el conjunto vacío— y reportó "0 grupos sin
 * card" cuando en realidad no había mirado ninguno. Un chequeo manual que sale
 * verde por vacío es peor que no chequear: deja la sensación de que está cubierto.
 * Por eso esto es un test y no una nota en el README.
 *
 * NO exige que toda extensión tenga card. Varias se administran sólo desde el
 * buscador central de `/settings/extension-settings`, y `mercadopago` es así por
 * decisión: casi todas sus variables son gate de registración o options de boot.
 * Lo que se exige es que la card que EXISTE no deje grupos afuera.
 */

const ADMIN_ROUTES = join(import.meta.dirname, '..', '..', '..', 'admin', 'routes');

/** Recorre `routes/` entero: las páginas cuelgan a profundidades distintas. */
function pagesUsingTheCard(dir: string): { file: string; src: string }[] {
  if (!existsSync(dir)) return [];
  const out: { file: string; src: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...pagesUsingTheCard(path));
    } else if (entry.name.endsWith('.tsx')) {
      const src = readFileSync(path, 'utf8');
      if (src.includes('<ExtensionSettingsCard')) out.push({ file: path, src });
    }
  }
  return out;
}

/** `extension:andreani` — los namespaces que la página monta. */
const namespacesIn = (src: string): string[] => [
  ...new Set([...src.matchAll(/namespace=["']([^"']+)["']/g)].map((m) => m[1]!)),
];

/**
 * Los grupos que la página nombra, en las DOS formas que se usan hoy:
 * `groups={['A', 'B']}` literal en el JSX, y `groups: ['A', 'B']` dentro de una
 * constante que después se recorre con `.map()` — que es como se arman las páginas
 * de las carriers, con 27 y 42 variables repartidas en secciones.
 */
const groupsIn = (src: string): Set<string> =>
  new Set(
    [...src.matchAll(/groups\s*[:=]\s*\{?\s*\[([^\]]*)\]/g)].flatMap((m) =>
      [...m[1]!.matchAll(/['"]([^'"]+)['"]/g)].map((g) => g[1]!)
    )
  );

/**
 * `true` si alguna card se monta SIN `groups`, o sea mostrando el namespace entero.
 * Ahí no hay nada que verificar: por definición no deja ningún grupo afuera.
 *
 * Mira cada tag por separado y no el archivo entero, porque una página puede tener
 * una card completa y otras acotadas; alcanza con que UNA sea completa.
 */
const hasUnfilteredCard = (src: string): boolean =>
  [...src.matchAll(/<ExtensionSettingsCard\b[\s\S]*?\/>/g)].some((m) => !m[0].includes('groups'));

const PAGES = pagesUsingTheCard(ADMIN_ROUTES);

/**
 * Piso de páginas inspeccionadas. Sin esto, mover `routes/` o cambiar el nombre del
 * componente dejaría el test en verde por vacío — la misma trampa que documenta
 * `src/api/route-collisions.test.ts`, y la que hizo mentir al script manual.
 */
const MIN_PAGES_WITH_CARD = 12;

test('el escaneo encuentra páginas: no puede salir verde por vacío', (t) => {
  if (!existsSync(ADMIN_ROUTES)) {
    t.skip('proyecto generado sin admin/routes/');
    return;
  }
  assert.ok(
    PAGES.length >= MIN_PAGES_WITH_CARD,
    `sólo ${PAGES.length} páginas montan ExtensionSettingsCard; se esperaban >= ` +
      `${MIN_PAGES_WITH_CARD}. Si de verdad bajaron, actualizá MIN_PAGES_WITH_CARD a mano.`
  );
});

test('ninguna card deja un grupo de su namespace sin mostrar', (t) => {
  if (!PAGES.length) {
    t.skip('proyecto generado sin admin/routes/');
    return;
  }
  const problems: string[] = [];

  for (const { file, src } of PAGES) {
    if (hasUnfilteredCard(src)) continue;

    const named = namespacesIn(src);
    const shown = groupsIn(src);

    for (const namespace of named) {
      const declared = findNamespace(namespace);
      if (!declared) continue; // lo reporta el test de abajo

      const missing = [
        ...new Set(declared.settings.filter((d) => !isCredentialSetting(d)).map((d) => d.group)),
      ].filter((g) => !shown.has(g));
      if (missing.length) {
        problems.push(
          `${file.split('/admin/')[1]}: ${namespace} declara los grupos ` +
            `[${missing.join(', ')}] y ninguna card los nombra. Esos ajustes existen ` +
            'en la API pero no se ven en la pantalla de la extensión.'
        );
      }
    }

    // Al revés: un grupo nombrado que ningún descriptor declara. Casi siempre es un
    // typo o un `group` renombrado en el descriptor y no acá — y el síntoma es una
    // sección vacía en la pantalla, que se lee como "no hay nada que configurar".
    if (named.length === 1) {
      const declared = findNamespace(named[0]!);
      if (declared) {
        const real = new Set(declared.settings.map((d) => d.group));
        for (const g of shown) {
          if (!real.has(g)) {
            problems.push(
              `${file.split('/admin/')[1]}: la card nombra el grupo '${g}', que ningún ` +
                `descriptor de ${named[0]} declara. Renderiza una sección vacía.`
            );
          }
        }
      }
    }
  }

  assert.deepEqual(problems, [], `\n  - ${problems.join('\n  - ')}\n`);
});

test('toda card apunta a un namespace que existe', (t) => {
  if (!PAGES.length) {
    t.skip('proyecto generado sin admin/routes/');
    return;
  }
  // Un namespace mal escrito no explota: `findNamespace()` devuelve null y la card
  // no renderiza nada. La página queda con un hueco silencioso.
  const problems: string[] = [];
  for (const { file, src } of PAGES) {
    for (const namespace of namespacesIn(src)) {
      if (!findNamespace(namespace)) {
        problems.push(
          `${file.split('/admin/')[1]}: monta '${namespace}', que no está en ` +
            'descriptors/index.ts. La card no va a renderizar nada.'
        );
      }
    }
  }
  assert.deepEqual(problems, [], `\n  - ${problems.join('\n  - ')}\n`);
});

test('el buscador central cubre lo que no tiene card propia', () => {
  // No es un requisito de UI sino la red: una extensión sin página de admin es
  // legítima, pero entonces `/settings/extension-settings` es el ÚNICO lugar donde
  // se pueden tocar sus ajustes. Esa pantalla lista `settingsNamespaces` entero, así
  // que lo único que hay que garantizar es que el namespace esté en el índice.
  const withCard = new Set(PAGES.flatMap(({ src }) => namespacesIn(src)));
  const onlyCentral = settingsNamespaces.map((n) => n.namespace).filter((n) => !withCard.has(n));

  for (const namespace of onlyCentral) {
    assert.ok(findNamespace(namespace), `${namespace}: sin card propia y fuera del índice`);
  }
});
