import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInitialFaviconSvg,
  buildInstanceBranding,
  EMPTY_INSTANCE_BRANDING,
  FALLBACK_BRAND_COLOR,
  toInstanceBrandingPayload,
} from './branding';

describe('buildInstanceBranding', () => {
  it('toma el nombre del Store aunque no haya theme', () => {
    const branding = buildInstanceBranding('Zeus', null);
    assert.equal(branding.name, 'Zeus');
    assert.equal(branding.logo, null);
    assert.equal(branding.icon, null);
  });

  it('acepta assets absolutos', () => {
    const branding = buildInstanceBranding('Zeus', {
      logo: 'https://cdn.example.com/logo.svg',
      icon: 'https://cdn.example.com/iso.png',
      favicon: 'https://cdn.example.com/fav.png',
      primary_color: '#76C615',
    });
    assert.equal(branding.logo, 'https://cdn.example.com/logo.svg');
    assert.equal(branding.icon, 'https://cdn.example.com/iso.png');
    assert.equal(branding.favicon, 'https://cdn.example.com/fav.png');
    assert.equal(branding.color, '#76C615');
  });

  /**
   * El caso que motiva el filtro. La semilla del template deja paths del `public/`
   * del STOREFRONT, y el admin se sirve desde el origen del BACKEND: dejarlos pasar
   * pone un ícono de imagen rota en la barra de toda instalación que no subió logo.
   */
  it('descarta los paths relativos del storefront', () => {
    const branding = buildInstanceBranding('Mercatto', {
      logo: '/logos-mercatto/logocompleto-verde.svg',
      icon: '/logo_full.webp',
      favicon: '/favicon.ico',
    });
    assert.equal(branding.logo, null);
    assert.equal(branding.icon, null);
    assert.equal(branding.favicon, null);
    // El nombre sigue llegando: la instalación se distingue igual.
    assert.equal(branding.name, 'Mercatto');
  });

  it('lee `mobile_logo` como fallback de `icon`', () => {
    const branding = buildInstanceBranding('Zeus', {
      mobile_logo: 'https://cdn.example.com/viejo.png',
    });
    assert.equal(branding.icon, 'https://cdn.example.com/viejo.png');
  });

  it('`icon` gana sobre el `mobile_logo` deprecado', () => {
    const branding = buildInstanceBranding('Zeus', {
      icon: 'https://cdn.example.com/nuevo.png',
      mobile_logo: 'https://cdn.example.com/viejo.png',
    });
    assert.equal(branding.icon, 'https://cdn.example.com/nuevo.png');
  });

  /** El color termina en un `style` inline: lo que no valide como hex no se emite. */
  it('descarta un color que no sea hex', () => {
    assert.equal(buildInstanceBranding('Zeus', { primary_color: 'red' }).color, null);
    assert.equal(
      buildInstanceBranding('Zeus', { primary_color: 'url(javascript:alert(1))' }).color,
      null,
    );
    assert.equal(buildInstanceBranding('Zeus', { primary_color: '#fff' }).color, '#fff');
  });

  it('trata vacíos y no-strings como ausentes', () => {
    const branding = buildInstanceBranding('   ', { logo: '   ', icon: 42, favicon: null });
    assert.deepEqual(branding, EMPTY_INSTANCE_BRANDING);
  });
});

describe('toInstanceBrandingPayload', () => {
  /**
   * `color` e `initial` salen resueltos del servidor para que el admin no traiga su
   * propia copia: son los mismos dos datos que dibujan el favicon generado, y una
   * divergencia no rompe nada — sólo hace que la pestaña y la barra no coincidan.
   */
  it('resuelve color e inicial', () => {
    const payload = toInstanceBrandingPayload(
      buildInstanceBranding('Zeus', { primary_color: '#76C615' }),
    );
    assert.equal(payload.color, '#76C615');
    assert.equal(payload.initial, 'Z');
  });

  it('aplica el color de fallback cuando la marca no lo definió', () => {
    const payload = toInstanceBrandingPayload(buildInstanceBranding('Zeus', null));
    assert.equal(payload.color, FALLBACK_BRAND_COLOR);
  });

  it('sin nombre la inicial es `?`', () => {
    const payload = toInstanceBrandingPayload(buildInstanceBranding(null, null));
    assert.equal(payload.initial, '?');
    assert.equal(payload.name, null);
  });
});

describe('buildInitialFaviconSvg', () => {
  it('pinta la inicial sobre el color de la marca', () => {
    const svg = buildInitialFaviconSvg('Zeus', '#76C615');
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /fill="#76C615"/);
    assert.match(svg, />Z<\/text>/);
  });

  /** El nombre viene de la base y termina dentro de un documento XML. */
  it('escapa el nombre', () => {
    const svg = buildInitialFaviconSvg('<script>', '#000');
    assert.ok(!svg.includes('<script>'));
    assert.match(svg, />&lt;<\/text>/);
  });
});
