import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ERP_CONFIG_LOOKUP_KINDS,
  ERP_CONFIG_LOOKUP_TARGETS,
  normalizeLookupRows,
} from './config-lookups.ts';

/**
 * El normalizador es tolerante a propósito (ver el docblock del módulo): el
 * nombre de los campos de los seis listados de Zeus NO está verificado. Estos
 * tests fijan el comportamiento que sostiene esa tolerancia — sobre todo los
 * casos donde una implementación ingenua BORRA opciones en silencio, que es el
 * modo de falla que importa: una lista incompleta se ve igual que una completa.
 */

test('mapea codigo + descripcion, que es el shape esperado', () => {
  const out = normalizeLookupRows([
    { codigo: '1', descripcion: 'Casa Central' },
    { codigo: '2', descripcion: 'Sucursal Bariloche' },
  ]);
  assert.deepEqual(
    out.map((o) => [o.value, o.label]),
    [
      ['1', '1 — Casa Central'],
      ['2', '2 — Sucursal Bariloche'],
    ]
  );
});

test('el codigo de negocio le gana al id interno', () => {
  // Guardar el id interno en `settings.zeus` produce un pedido que Zeus rechaza
  // sin explicar por qué. Si la fila trae los dos, gana `codigo`.
  const out = normalizeLookupRows([{ id: 9987, codigo: '3', descripcion: 'Depósito KM4' }]);
  assert.equal(out[0]?.value, '3');
});

test('acepta id cuando no hay codigo', () => {
  const out = normalizeLookupRows([{ id: 5, nombre: 'Consumidor Final' }]);
  assert.deepEqual([out[0]?.value, out[0]?.label], ['5', '5 — Consumidor Final']);
});

test('el nombre de la clave se compara sin caso ni separadores', () => {
  // Zeus mezcla estilos entre endpoints: razon_social en clientes, puntoDeVenta
  // en comprobantes. Las tres variantes tienen que resolver igual.
  for (const row of [
    { Codigo: '7', Razon_Social: 'Vendedor Uno' },
    { codigo: '7', razonSocial: 'Vendedor Uno' },
    { CODIGO: '7', 'RAZON-SOCIAL': 'Vendedor Uno' },
  ]) {
    const out = normalizeLookupRows([row]);
    assert.deepEqual([out[0]?.value, out[0]?.label], ['7', '7 — Vendedor Uno']);
  }
});

test('el codigo 0 es una opción válida y no se descarta', () => {
  // Una categoría de IVA o un depósito pueden ser legítimamente el código 0.
  // Un `||` en el picker los borraría de la lista, sin ningún error.
  const out = normalizeLookupRows([{ codigo: 0, descripcion: 'No gravado' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.value, '0');
});

test('sin ninguna clave de etiqueta, la opción sigue siendo elegible', () => {
  // Es el caso que prueba que el nombre real del campo no está en LABEL_KEYS.
  // Preferimos un selector con códigos pelados a una pantalla vacía.
  const out = normalizeLookupRows([{ codigo: '12', algo_inesperado: 'Contado' }]);
  assert.deepEqual([out[0]?.value, out[0]?.label], ['12', '12']);
});

test('conserva la fila cruda para poder diagnosticar sin volver a llamar', () => {
  const row = { codigo: '4', descripcion: 'Visa', banco: 'X', activo: true };
  assert.deepEqual(normalizeLookupRows([row])[0]?.raw, row);
});

test('saltea las filas inactivas', () => {
  const out = normalizeLookupRows([
    { codigo: '1', descripcion: 'Vigente', activo: true },
    { codigo: '2', descripcion: 'Dada de baja', activo: false },
  ]);
  assert.deepEqual(
    out.map((o) => o.value),
    ['1']
  );
});

test('deduplica por codigo conservando la primera', () => {
  const out = normalizeLookupRows([
    { codigo: '1', descripcion: 'Primera' },
    { codigo: '1', descripcion: 'Repetida' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.label, '1 — Primera');
});

test('descarta filas sin codigo en vez de crear una opción sin valor', () => {
  const out = normalizeLookupRows([{ descripcion: 'Sin código' }, { codigo: '1' }]);
  assert.deepEqual(
    out.map((o) => o.value),
    ['1']
  );
});

test('no explota con lo que no es una lista de objetos', () => {
  for (const input of [null, undefined, {}, 'texto', 42, [null, 'x', 7, []]]) {
    assert.deepEqual(normalizeLookupRows(input), []);
  }
});

test('un objeto anidado no se usa como valor ni como etiqueta', () => {
  // `String({})` daría "[object Object]" y sería una opción imposible de elegir.
  const out = normalizeLookupRows([{ codigo: { nested: 1 }, id: '8', descripcion: { x: 1 } }]);
  assert.deepEqual([out[0]?.value, out[0]?.label], ['8', '8']);
});

test('cada listado declara a qué campo de la config alimenta', () => {
  // Si aparece un listado nuevo sin target, la UI no sabe dónde poner el
  // selector y el campo queda como texto libre sin que nadie se entere.
  for (const kind of ERP_CONFIG_LOOKUP_KINDS) {
    assert.equal(typeof ERP_CONFIG_LOOKUP_TARGETS[kind], 'string', `falta el target de ${kind}`);
  }
  assert.equal(
    Object.keys(ERP_CONFIG_LOOKUP_TARGETS).length,
    ERP_CONFIG_LOOKUP_KINDS.length,
    'ERP_CONFIG_LOOKUP_TARGETS tiene claves que no son listados'
  );
});
