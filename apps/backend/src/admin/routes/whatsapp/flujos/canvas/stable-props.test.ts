import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

/**
 * NINGÚN PROP DE `<ReactFlow>` SE DECLARA INLINE.
 *
 * React Flow guarda cada prop en su store de Zustand y lo REESCRIBE cuando le cambia
 * la identidad. Un objeto o una función declarados inline son nuevos en cada render,
 * así que cada render escribe el store, el store despierta a sus suscriptores, eso
 * dispara otro render — y el canvas entero parpadea sin que nadie toque nada.
 *
 * Pasó en producción el 2026-09-16, con seis props inline: `onSelectionChange`,
 * `onPaneClick`, `onEdgeMouseEnter`, `onEdgeMouseLeave`, `fitViewOptions`,
 * `proOptions` e `isValidConnection`. El síntoma era el inspector saltando solo entre
 * el panel del paso y el del recorrido, con el mouse quieto, y **no dejó ni un error
 * en consola** — que es lo que hace que este bug se busque en el lugar equivocado
 * durante un rato largo.
 *
 * Es un test de texto y no de comportamiento porque un componente del admin no se
 * puede montar en este repo. Mide lo único que se puede medir sin navegador, que es
 * justo donde estuvo el error: la forma en que se escriben los props.
 */

const CANVAS = join(import.meta.dirname, 'flow-canvas.tsx');

/** El contenido de la etiqueta de apertura de `<ReactFlow …>`. */
function reactFlowProps(source: string): string {
  const desde = source.indexOf('<ReactFlow');
  assert.ok(desde !== -1, 'no encontré el <ReactFlow> en flow-canvas.tsx');
  // La etiqueta abre hasta el primer `>` que cierra la apertura; los props no
  // contienen `>` sueltos salvo dentro de una flecha, que es justo lo que se prohíbe.
  const hasta = source.indexOf('\n      >', desde);
  assert.ok(hasta !== -1, 'no encontré el cierre de la etiqueta de apertura');
  return source.slice(desde, hasta);
}

describe('los props del canvas no pueden cambiar de identidad en cada render', () => {
  const apertura = reactFlowProps(readFileSync(CANVAS, 'utf8'));

  it('ninguno es una función inline', () => {
    // `onSelectionChange={() => …}` o `={(a) => …}`: nuevo en cada render.
    const inline = [...apertura.matchAll(/(\w+)=\{\s*(?:\(|async\s*\()/g)].map((m) => m[1]);
    assert.deepEqual(
      inline,
      [],
      `Estos props son funciones inline y hacen parpadear el canvas: ${inline.join(', ')}.\n` +
        'Memoizalos con useCallback([]) leyendo del ref `latest`, o sacalos del componente.',
    );
  });

  it('ninguno es un objeto o un arreglo inline', () => {
    // `fitViewOptions={{ … }}` / `panOnDrag={[1, 2]}`: nuevos en cada render.
    const inline = [...apertura.matchAll(/(\w+)=\{\s*[[{]/g)].map((m) => m[1]);
    assert.deepEqual(
      inline,
      [],
      `Estos props son objetos o arreglos inline y hacen parpadear el canvas: ${inline.join(', ')}.\n` +
        'Declaralos como constante de módulo.',
    );
  });

  it('el listener del teclado se registra una sola vez', () => {
    // Dependía de `props`, que es un objeto nuevo en cada render: se desregistraba y
    // volvía a registrar constantemente.
    const source = readFileSync(CANVAS, 'utf8');
    assert.ok(
      !/removeEventListener\('keydown'[\s\S]{0,80}\}, \[props\]\)/.test(source),
      'el efecto del teclado no puede depender de `props`',
    );
  });

  it('el test mira algo: encuentra los props que SÍ están bien', () => {
    // Si el recorte de la etiqueta fallara, los dos tests de arriba pasarían en verde
    // sin haber mirado nada.
    assert.ok(apertura.includes('onSelectionChange='), 'no recorté la etiqueta de apertura');
    assert.ok(apertura.includes('nodeTypes='));
  });
});
