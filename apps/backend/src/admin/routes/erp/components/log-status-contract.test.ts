import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * GUARDAS DE UN BUG QUE EL COMPILADOR NO PUEDE VER.
 *
 * `@medusajs/ui` 4.2.0 declara el callback del click de fila así:
 *
 *     onRowClick?: (event: React.MouseEvent<…>, row: TData) => void
 *
 * y lo INVOCA así (`blocks/data-table/components/data-table-table.js`):
 *
 *     onClick: (e) => instance.onRowClick?.call(instance, e, row)
 *
 * donde `row` sale de `getRowModel().rows`, o sea el `Row` de TanStack
 * (`{ id, index, original, … }`) y NO el item. **El tipo miente**: `tsc --noEmit`
 * pasa limpio, la suite pasa limpia, y el error sale recién al hacer click en
 * producción. Pasó de verdad: `statusLabelKey(row.status)` con `status`
 * undefined tiró `Cannot read properties of undefined (reading 'toUpperCase')`
 * y dejó el detalle del sync inaccesible.
 *
 * Estos tests leen el FUENTE en lugar de importarlo, siguiendo el patrón de
 * `admin/components/common/setting-label.test.ts`: los `.tsx` del admin no se
 * pueden importar desde el runner (el resolve hook resuelve extensiones, no
 * transforma JSX). Es menos elegante que un render, pero es lo que hay, y pinchan
 * exactamente las dos líneas que se rompieron.
 */

const HERE = import.meta.dirname;
const read = (relative: string): string => readFileSync(join(HERE, relative), 'utf8');

test('statusLabelKey tolera un status ausente antes de tocarlo', () => {
  const source = read('shared.tsx');
  const body = source.slice(source.indexOf('export function statusLabelKey'));
  const guard = body.slice(0, body.indexOf('.toUpperCase()'));

  assert.match(
    guard,
    /if \(!status\) return 'ST_UNKNOWN';/,
    'La guarda tiene que estar ANTES del `.toUpperCase()`: sin ella un status ' +
      'ausente no rompe la celda, rompe la pantalla entera, porque esto se ' +
      'llama desde el render de las columnas y del header.'
  );
  assert.match(
    body.slice(0, body.indexOf('{')),
    /status: string \| null \| undefined/,
    'La firma tiene que admitir null/undefined; si dice `string`, el compilador ' +
      'sigue creyendo que la guarda es código muerto y alguien la va a borrar.'
  );
});

test('ST_UNKNOWN está definido en los dos idiomas', () => {
  // i18next NO rompe con una clave que no existe: pinta el NOMBRE de la clave.
  // Un badge que dice "ST_UNKNOWN" es casi tan malo como el crash. Ver
  // `admin/translations/ghost-keys.test.ts`.
  const translations = readFileSync(
    join(HERE, '../../../translations/erp/index.ts'),
    'utf8'
  );
  const hits = translations.match(/^\s*ST_UNKNOWN:/gm) ?? [];
  assert.equal(hits.length, 2, 'ST_UNKNOWN tiene que estar en `en` y en `es`.');
});

test('el drawer del log toma el item del Row de TanStack, no el Row', () => {
  const page = read('../logs/[id]/page.tsx');
  const handler = page.slice(page.indexOf('onRowClick:'));
  const block = handler.slice(0, handler.indexOf('\n  });'));

  assert.match(
    block,
    /\.original \?\? /,
    'El handler tiene que desenvolver `row.original`: `@medusajs/ui` entrega el ' +
      'Row de TanStack aunque su tipo diga `TData`.'
  );
  assert.doesNotMatch(
    block,
    /setOpenItem\(row\)/,
    'Pasarle `row` derecho a `setOpenItem` es exactamente el bug: el drawer ' +
      'queda con `{ id, index, original }` y `status` en undefined.'
  );
});
