import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guardas del adelgazamiento de las filas de ajustes.
 *
 * Mover las ~100 ayudas largas a un tooltip mejora la pantalla y puede empeorar
 * la experiencia de quien la escucha, porque el contenido del `Tooltip` cuelga
 * del ÍCONO y `aria-describedby` del control apunta a `helpId`. Si el texto sale
 * del DOM, el input se queda sin descripción: se ve mejor y se escucha peor, que
 * es el mismo bug con otra víctima.
 *
 * `SettingField` lo resuelve dejando el texto en un `<span className="sr-only">`
 * con el mismo id. Eso no lo protege ningún tipo —es una decisión de render que
 * un refactor "de limpieza" borra sin que nada falle— así que se hace cumplir
 * acá.
 *
 * ─── Por qué se analiza el FUENTE y no se importan los módulos ───────────────
 *
 * Porque no se puede: el runner es `node --test` con `--experimental-transform-types`,
 * que sabe borrar tipos pero NO entiende JSX, así que importar un `.tsx` muere con
 * `ERR_UNKNOWN_FILE_EXTENSION` antes del primer assert. Por eso TODOS los tests
 * del admin que tocan componentes son tripwires sobre el texto del fuente
 * (`lib/site-scope.test.ts`, `common/card-site-context.test.ts`). No es una
 * preferencia de estilo: es la única forma que hay.
 */

const HERE = import.meta.dirname;
const read = (...segments: string[]) => readFileSync(join(HERE, ...segments), 'utf8');

const settingField = read('..', 'app-settings', 'setting-field.tsx');
const settingLabel = read('setting-label.tsx');

test('la ayuda larga sigue en el DOM para aria-describedby', () => {
  assert.match(
    settingField,
    /className="sr-only"/,
    'SettingField dejó de renderizar el ancla `sr-only` de la ayuda larga. ' +
      'Sin ella, `describedByFor` apunta `aria-describedby` a un id que no existe ' +
      'y el control se queda sin descripción para un lector de pantalla. ' +
      'El texto puede estar oculto a la vista, pero NO puede salir del DOM.',
  );

  // El ancla y el texto visible tienen que compartir el `helpId`: es lo que hace
  // que las dos ramas sean intercambiables para `aria-describedby`.
  const helpIdUses = settingField.match(/id=\{helpId\(descriptor\.key\)\}/g) ?? [];
  assert.equal(
    helpIdUses.length,
    2,
    `Se esperaban 2 usos de helpId (ayuda corta en línea + ancla sr-only de la larga), ` +
      `hay ${helpIdUses.length}. Si quedó uno solo, una de las dos ramas perdió su id.`,
  );
});

test('SettingField decide el tooltip con el umbral compartido', () => {
  assert.match(
    settingField,
    /isLongHelp\(descriptor\.help\)/,
    'SettingField tiene que usar `isLongHelp` y no su propia comparación: ' +
      'un umbral duplicado se desincroniza y entonces el label pinta el ícono ' +
      'mientras la fila sigue mostrando el párrafo, o al revés.',
  );
});

test('el umbral vive en un solo lugar', () => {
  const declarations = settingLabel.match(/LONG_HELP_THRESHOLD\s*=/g) ?? [];
  assert.equal(
    declarations.length,
    1,
    'El umbral de ayuda larga tiene que declararse una sola vez, en `setting-label.tsx`.',
  );

  assert.match(
    settingLabel,
    /length\s*>\s*LONG_HELP_THRESHOLD/,
    '`isLongHelp` tiene que comparar contra la constante, no contra un número suelto: ' +
      'un literal repetido es el umbral duplicado por otro camino.',
  );
});

/**
 * `ErpSettingLabel` fue el original y quedó como alias. Si alguien vuelve a
 * escribir el componente en ERP en vez de importarlo, las ayudas largas de esa
 * extensión dejan de seguir al resto y el arreglo se desarma justo por donde
 * empezó.
 */
test('ERP usa el componente compartido y no su propia copia', () => {
  const erpShared = read('..', '..', 'routes', 'erp', 'components', 'shared.tsx');

  assert.match(
    erpShared,
    /export\s*\{\s*SettingLabel as ErpSettingLabel\s*\}/,
    'ERP tiene que reexportar `SettingLabel`, no redefinirlo.',
  );
  assert.doesNotMatch(
    erpShared,
    /<Tooltip/,
    'Volvió a aparecer un `Tooltip` en `erp/components/shared.tsx`: es la copia del ' +
      'label que se acaba de unificar en `common/setting-label.tsx`.',
  );
});
