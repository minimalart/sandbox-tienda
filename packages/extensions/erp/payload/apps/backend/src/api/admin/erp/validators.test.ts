import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UpsertErpConfigSchema } from './validators.ts';

/**
 * El schema Zod descarta en SILENCIO las claves que no declara (strip mode).
 * Un campo nuevo en `ErpConfigSettings` que no viaje en el schema nunca se
 * guarda, sin error visible — mismo bug de la Fase D con `odoo`, ahora en
 * `catalog_sync.images.min_dimension_px`. Estos tests son la red para que no
 * vuelva a pasar sin que el `pnpm test` avise.
 */
describe('UpsertErpConfigSchema — catalog_sync.images.min_dimension_px', () => {
  it('preserva `min_dimension_px` cuando viene explícito', () => {
    const parsed = UpsertErpConfigSchema.parse({
      settings: { catalog_sync: { images: { enabled: true, min_dimension_px: 250 } } },
    });
    assert.equal(parsed.settings?.catalog_sync?.images?.min_dimension_px, 250);
  });

  it('acepta 0 como valor válido (deshabilita el filtro)', () => {
    // `0` es la señal "importá cualquier imagen" — que la validación numérica
    // acepte `.min(0)` y no `.min(1)` es lo que hace toda la feature usable.
    const parsed = UpsertErpConfigSchema.parse({
      settings: { catalog_sync: { images: { min_dimension_px: 0 } } },
    });
    assert.equal(parsed.settings?.catalog_sync?.images?.min_dimension_px, 0);
  });

  it('rechaza valores negativos', () => {
    assert.throws(() =>
      UpsertErpConfigSchema.parse({
        settings: { catalog_sync: { images: { min_dimension_px: -1 } } },
      })
    );
  });

  it('rechaza valores no enteros', () => {
    assert.throws(() =>
      UpsertErpConfigSchema.parse({
        settings: { catalog_sync: { images: { min_dimension_px: 100.5 } } },
      })
    );
  });

  it('la clave sigue siendo opcional (omitirla no rompe)', () => {
    const parsed = UpsertErpConfigSchema.parse({
      settings: { catalog_sync: { images: { enabled: true } } },
    });
    assert.equal(parsed.settings?.catalog_sync?.images?.min_dimension_px, undefined);
    assert.equal(parsed.settings?.catalog_sync?.images?.enabled, true);
  });
});
