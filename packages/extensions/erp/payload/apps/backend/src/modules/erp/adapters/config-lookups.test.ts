import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ERP_CONFIG_LOOKUP_KINDS,
  ERP_CONFIG_LOOKUP_TARGETS,
  inspectLookupRows,
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

/**
 * Los cinco listados que la primera corrida contra la cuenta real de desdeelsur
 * (2026-09-11) devolvió VACÍOS con `errors: {}`.
 *
 * El único que funcionaba era `/tarjetas`, y funcionaba porque devuelve
 * `{codigo, nombre}`. Los otros cinco nombran su código con el de la entidad
 * adentro (los nombres salen de `docs/recipes/erp-zeus.md`), así que al
 * aplanarse no coincidían con ninguna clave de `VALUE_KEYS` y la fila se
 * descartaba por "sin código".
 */
test('el codigo con el nombre de la entidad adentro: el caso real de los cinco vacios', () => {
  const casos: Array<[string, Record<string, unknown>, string]> = [
    ['condiciones-ventas', { codigo_condicion_de_venta: '01', descripcion: 'Contado' }, '01'],
    ['sucursales', { codigo_de_sucursal: 1, descripcion: 'Casa central' }, '1'],
    ['depositos', { codigo_de_deposito: 3, descripcion: 'Depósito 3' }, '3'],
    ['categorias-iva', { codigo_iva: 5, descripcion: 'Consumidor final' }, '5'],
    ['vendedores', { codigo_de_vendedor: 'V01', nombre: 'Mostrador' }, 'V01'],
  ];
  for (const [kind, row, esperado] of casos) {
    const [option] = normalizeLookupRows([row]);
    assert.ok(option, `${kind}: la fila se descartó y ese listado queda vacío`);
    assert.equal(option.value, esperado, `${kind}: código mal extraído`);
  }
});

test('el codigo del cliente (Contado = 01) sale con su etiqueta', () => {
  const [option] = normalizeLookupRows([
    { codigo_condicion_de_venta: '01', descripcion: 'Contado' },
  ]);
  assert.equal(option?.value, '01');
  assert.equal(option?.label, '01 — Contado');
});

test('`codigo` exacto le gana al que lleva la entidad adentro', () => {
  const [option] = normalizeLookupRows([
    { codigo_de_sucursal: '99', codigo: '1', descripcion: 'Casa central' },
  ]);
  assert.equal(option?.value, '1', 'el fallback por prefijo no puede pisar a `codigo`');
});

test('codigo_postal NO se toma como codigo de la fila', () => {
  assert.deepEqual(
    normalizeLookupRows([{ codigo_postal: 'R8400', descripcion: 'Bariloche' }]),
    [],
    'un CP guardado como código produce un pedido que Zeus rechaza sin explicar'
  );
});

test('inspectLookupRows distingue "no vino nada" de "vino y no se pudo usar"', () => {
  const vacio = inspectLookupRows([]);
  assert.deepEqual(vacio, { options: [], received: 0, sample_keys: [] });

  const noLista = inspectLookupRows(null);
  assert.equal(noLista.received, 0, 'una respuesta que no es lista cuenta como nada recibido');

  const ilegible = inspectLookupRows([{ clave_rara: 'x', otra: 1 }]);
  assert.equal(ilegible.received, 1);
  assert.equal(ilegible.options.length, 0);
  assert.deepEqual(
    ilegible.sample_keys,
    ['clave_rara', 'otra'],
    'sin las claves reales, arreglarlo exige credenciales y otra corrida'
  );
});

test('con opciones usables no se exponen las claves crudas', () => {
  const ok = inspectLookupRows([{ codigo: '1', nombre: 'VISA' }]);
  assert.equal(ok.received, 1);
  assert.equal(ok.options.length, 1);
  assert.deepEqual(
    ok.sample_keys,
    [],
    'son datos de la cuenta del cliente, no ruido de diagnóstico'
  );
});
