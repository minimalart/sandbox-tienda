import { test } from 'node:test';
import assert from 'node:assert/strict';
import descriptors from '../app-settings/descriptors/erp.ts';

/**
 * El contrato de env vars del ERP, congelado.
 *
 * `manifest-drift.test.ts` sólo mira los namespaces que están en
 * `descriptors/index.ts`, y `extension:erp` todavía no está: el ensamblado (index +
 * `component-metadata.js` + sacar la entrada de `env-coverage.test.ts`) va en otro
 * paso. Hasta que eso pase, este archivo es lo que impide que el descriptor se
 * desalinee.
 *
 * ─── ESTE TEST CUSTODIA UNA DECISIÓN, NO UNA LISTA ───────────────────────────
 *
 * Las 10 quedaron en `envOnly` y el namespace no tiene NI UN ajuste editable. Eso se
 * ve raro, así que lo primero que va a hacer alguien que pase por acá es "arreglarlo"
 * dándole una card a `STOCK_LOCATION` y a `SHIPPING_PROFILE`, que parecen las
 * candidatas obvias. No lo son, y el motivo no es que no se puedan migrar: es que ya
 * existen.
 *
 * `erp_config.stock_location_id` y `erp_config.shipping_profile_id` son los ajustes
 * de RUNTIME equivalentes —los que gobiernan el sync— y la pantalla del ERP los edita
 * con selects de entidades reales. Las env vars son otra cosa: NOMBRES (no ids) que
 * lee un solo archivo, `scripts/import-vtex.ts`, un `medusa exec` de una pasada que
 * levanta un JSON que en una instalación normal ni existe.
 *
 * O sea que darles card no agregaría una perilla: agregaría un SEGUNDO depósito de
 * texto libre al lado del dropdown bueno, en la misma pantalla, gobernando otra cosa.
 * Ese es exactamente el error de configuración que toda esta migración existe para
 * evitar.
 */

const ENV_ONLY_KEYS = [
  'APPLY',
  'DEFAULT_CURRENCY_CODE',
  'ERP_CATALOG_SYNC_CRON',
  'ERP_ODOO_WEBHOOK_TOKEN',
  'ERP_OUTBOX_CRON',
  'ERP_STOCK_SYNC_CRON',
  'NEXT_PUBLIC_BASE_URL',
  'SHIPPING_PROFILE',
  'STOCKED_QUANTITY',
  'STOCK_LOCATION',
];

test('las 10 variables están declaradas y ninguna es editable', () => {
  assert.deepEqual((descriptors.envOnly ?? []).map((e) => e.key).sort(), [...ENV_ONLY_KEYS].sort());
  assert.deepEqual(
    descriptors.settings,
    [],
    'Si acá aparece un ajuste, leé el docblock de este archivo antes de darlo por bueno.',
  );
});

test('los tres crones explican que el schedule se hornea al arrancar', () => {
  // Regla general de la migración: un `*_CRON` que sólo se usa como `schedule:` de un
  // job nunca baja a la base, porque el loader lo lee antes de que exista. Lo que sí
  // puede bajar es el kill switch o la ventana que el job evalúa dentro de su cuerpo
  // — y los tres jobs del ERP hoy no tienen ninguno.
  for (const key of ['ERP_CATALOG_SYNC_CRON', 'ERP_OUTBOX_CRON', 'ERP_STOCK_SYNC_CRON']) {
    const entry = (descriptors.envOnly ?? []).find((e) => e.key === key)!;
    assert.match(entry.reason, /job-loader|arrancar/, `${key}: la razón no dice por qué no se puede`);
  }
});

test('las tres del importador VTEX apuntan a su equivalente de runtime', () => {
  // Sin esto, la razón sería "es de un script" y la pregunta siguiente —"¿y entonces
  // dónde configuro el depósito del ERP?"— quedaría sin respuesta en la pantalla.
  const byKey = new Map((descriptors.envOnly ?? []).map((e) => [e.key, e]));
  assert.match(byKey.get('STOCK_LOCATION')!.reason, /erp_config\.stock_location_id/);
  assert.match(byKey.get('SHIPPING_PROFILE')!.reason, /erp_config\.shipping_profile_id/);
  assert.match(byKey.get('STOCKED_QUANTITY')!.reason, /import-vtex/);
});

test('DEFAULT_CURRENCY_CODE no la edita nadie, y la razón lo dice', () => {
  // Es de la INSTALACIÓN: la leen el ERP, Typesense y el importador de catálogo. Si
  // alguna de las tres se la apropia, terminamos con un catálogo mitad en una moneda
  // y mitad en otra, sin ningún error visible.
  const entry = (descriptors.envOnly ?? []).find((e) => e.key === 'DEFAULT_CURRENCY_CODE')!;
  assert.match(entry.reason, /INSTALACIÓN|instalación/);
});
