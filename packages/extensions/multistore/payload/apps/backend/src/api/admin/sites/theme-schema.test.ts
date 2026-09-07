import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CreateDemoStoreSchema,
  ThemeSchema,
  UpdateDemoStoreSchema,
} from './schemas.ts';

/**
 * El bug que este test retira para siempre: `theme` estaba definido DOS veces —
 * `ThemeSchema` acá y una copia inline dentro de `UpdateDemoStoreSchema`. Zod
 * strippea lo que no está en el schema, así que un campo nuevo agregado sólo a uno
 * de los dos **se guardaba al crear y se perdía al editar, sin ningún error**. Ya
 * mordió dos veces.
 *
 * Ahora hay una sola definición. Estos tests son el guard de que siga así: no
 * comparan estructura (eso sería tautológico si es el mismo objeto), comparan el
 * COMPORTAMIENTO — que una clave sobreviva los dos caminos.
 */

/** Todas las claves del theme, con valores distinguibles. */
const FULL_THEME = {
  primary_color: '#111111',
  secondary_color: '#222222',
  accent_color: '#333333',
  header_background: '#444444',
  footer_background: '#555555',
  logo: '/logo.svg',
  logo_negative: '/logo-neg.svg',
  icon: '/icon.svg',
  icon_negative: '/icon-neg.svg',
  mobile_logo: '/mobile.svg',
  favicon: '/favicon.ico',
  favicon_negative: '/favicon-neg.ico',
  typography: 'Inter',
};

const baseCreate = {
  name: 'Tienda Test',
  slug: 'tienda-test',
  country_code: 'ar',
  currency_code: 'ars',
  source_type: 'woocommerce' as const,
  source_url: 'https://ejemplo.com',
};

describe('theme: una clave sobrevive crear Y editar', () => {
  it('crear conserva las 13 claves', () => {
    const parsed = CreateDemoStoreSchema.parse({ ...baseCreate, theme: FULL_THEME });
    assert.deepEqual(parsed.theme, FULL_THEME);
  });

  it('editar conserva las 13 claves', () => {
    const parsed = UpdateDemoStoreSchema.parse({ theme: FULL_THEME });
    assert.deepEqual(parsed.theme, FULL_THEME);
  });

  it('crear y editar aceptan EXACTAMENTE el mismo set de claves', () => {
    const created = CreateDemoStoreSchema.parse({ ...baseCreate, theme: FULL_THEME }).theme;
    const updated = UpdateDemoStoreSchema.parse({ theme: FULL_THEME }).theme;
    assert.deepEqual(
      Object.keys(created ?? {}).sort(),
      Object.keys(updated ?? {}).sort(),
      'Los dos caminos aceptan sets de claves distintos: un campo se va a perder al ' +
        'editar. Usá el ThemeSchema exportado en los dos, no una copia inline.'
    );
  });

  it('mobile_nav_icon ya no es una clave del theme: se strippea al guardar', () => {
    // Existió hasta DESDEELSUR-29 y elegía cuál de los dos isotipos usaba el
    // botón de home de la barra mobile. La opción 'negative' sólo podía dejar
    // ese botón vacío —el círculo es `bg-white` y el negativo es blanco— así
    // que se retiró. Sin migración a propósito: este assert documenta que las
    // filas guardadas con la clave se limpian solas en el próximo guardado, en
    // vez de fallar con un 400.
    const parsed = ThemeSchema.parse({ mobile_nav_icon: 'negative' }) as Record<string, unknown>;
    assert.equal('mobile_nav_icon' in parsed, false);
  });

  it('una clave que NO está en el schema se strippea en los dos caminos', () => {
    // Documenta el mecanismo del bug: Zod no falla, borra.
    const withExtra = { ...FULL_THEME, color_inventado: '#fff' };
    const created = CreateDemoStoreSchema.parse({ ...baseCreate, theme: withExtra }).theme as any;
    const updated = UpdateDemoStoreSchema.parse({ theme: withExtra }).theme as any;
    assert.equal(created.color_inventado, undefined);
    assert.equal(updated.color_inventado, undefined);
  });

  it('ThemeSchema es la única fuente: cubre las 13 claves', () => {
    assert.deepEqual(Object.keys(ThemeSchema.parse(FULL_THEME)).sort(), Object.keys(FULL_THEME).sort());
  });
});

describe('content_config: description tiene que sobrevivir el guardado', () => {
  it('description no se strippea (alimenta metadata.description y la social card)', () => {
    const parsed = UpdateDemoStoreSchema.parse({
      content_config: { description: 'La mejor tienda' },
    });
    assert.equal((parsed.content_config as any)?.description, 'La mejor tienda');
  });
});
