import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * DOS SELECTORES DE TIENDA EN LA MISMA PANTALLA, O NINGUNO DONDE HACE FALTA.
 *
 * `ExtensionSettingsCard` monta su propia franja de tienda adentro
 * (`extension-settings-card.tsx`), derivando el scope de los descriptores del
 * namespace. Una página que además monta su `CardSiteContext` termina con DOS.
 *
 * Y no alcanza con apagar siempre la de la card, porque los dos casos existen:
 *
 *  - `loyalty/configuracion` — la franja de la página dice `site` y los descriptores
 *    de `loyalty-engine` son `site`. Misma cosa dicha dos veces: la de la card se
 *    apaga con `hideSiteContext`.
 *  - `seo-geo/configuracion` — la franja de la página dice `site` (su ruta filtra por
 *    tienda) pero los descriptores de `seo-geo` son `instance` (los consume el
 *    crawler, que corre en jobs sin `SiteResolution`). Apagar la de la card dejaría
 *    esos ajustes debajo de un cartel que dice "Configurando Norte" y el operador
 *    leería que son de Norte. NO lo son. Acá la repetición es lo único que evita
 *    que el selector de arriba se lea como si gobernara toda la pantalla.
 *
 * O sea: la regla no es "apagá la de abajo", es **misma capa → una franja; capas
 * distintas → las dos**. Eso no lo expresa ningún tipo, y a ojo se ve igual en los
 * dos casos — por eso el duplicado de loyalty sobrevivió hasta que alguien lo miró.
 *
 * Se analiza el fuente como texto porque el runner (`node --test`) no puede importar
 * `.tsx`: no entiende JSX. Misma técnica que `lib/site-scope.test.ts`.
 */

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

const ADMIN_DIR = join(import.meta.dirname, '..', '..');
const ROUTES_DIR = join(ADMIN_DIR, 'routes');
const DESCRIPTORS_DIR = join(ADMIN_DIR, '..', 'modules', 'app-settings', 'descriptors');

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
};

/** `defaultScope` declarado por el namespace, o `undefined` si no hay descriptor. */
const descriptorScope = (namespace: string): string | undefined => {
  const slug = namespace.replace(/^extension:/, '');
  try {
    const src = readFileSync(join(DESCRIPTORS_DIR, `${slug}.ts`), 'utf8');
    return stripComments(src).match(/defaultScope:\s*'(site|instance)'/)?.[1];
  } catch {
    return undefined;
  }
};

type Offence = { file: string; namespace: string; detail: string };

const offences: Offence[] = [];

for (const path of walk(ROUTES_DIR)) {
  const src = stripComments(readFileSync(path, 'utf8'));

  // Sólo las páginas que declaran su scope explícitamente. `SiteScopeBar` lo saca
  // del registro y resolverlo acá haría el test el doble de largo para cubrir
  // pantallas de lista, que no montan cards de ajustes.
  const pageScope = src.match(/<CardSiteContext[^>]*\bscope="(site|instance)"/)?.[1];
  if (!pageScope) continue;

  for (const [tag] of src.matchAll(/<ExtensionSettingsCard[\s\S]*?\/>/g)) {
    const namespace = tag.match(/namespace="([^"]+)"/)?.[1];
    if (!namespace) continue;

    const cardScope = descriptorScope(namespace);
    if (!cardScope) continue; // Sin descriptor no hay nada que comparar.

    const hidden = /\bhideSiteContext\b/.test(tag);
    const file = path.slice(ROUTES_DIR.length + 1);

    if (cardScope === pageScope && !hidden) {
      offences.push({
        file,
        namespace,
        detail:
          `la página y ${namespace} son las dos '${pageScope}': la card repite la ` +
          `franja de la página. Agregá \`hideSiteContext\`.`,
      });
    }

    if (cardScope !== pageScope && hidden) {
      offences.push({
        file,
        namespace,
        detail:
          `la página es '${pageScope}' y ${namespace} es '${cardScope}': son capas ` +
          `DISTINTAS. Con \`hideSiteContext\` esos ajustes quedan bajo un cartel que ` +
          `habla de otra capa. Sacalo.`,
      });
    }
  }
}

test('la franja de tienda no se duplica ni se calla cuando hace falta', () => {
  const detail = offences.map((o) => `  ${o.file}\n    ${o.detail}`).join('\n');

  assert.deepEqual(
    offences,
    [],
    `Pantallas con el contexto de tienda mal repartido:\n\n${detail}\n\n` +
      `Regla: misma capa → una sola franja (la de la página); capas distintas → las dos, ` +
      `porque cada card tiene que decir a qué responde.`,
  );
});
