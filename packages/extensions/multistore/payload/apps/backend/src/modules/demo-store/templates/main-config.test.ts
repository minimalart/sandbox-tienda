import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTenantConfig } from './index.ts';
import { supermercadoTemplate } from './supermercado.ts';
import type { DemoStoreLike } from './types.ts';
import { MAIN_STORE_ID, MAIN_STORE_THEME_SEED } from '../main-store.ts';

/**
 * `buildTenantConfig(filaPrincipal)` es lo que va a alimentar el sitio principal a
 * partir de la Fase 5. Antes de que exista la fila, el principal se renderizaba con
 * `defaultConfig` del storefront; después, con este payload mergeado ENCIMA.
 *
 * El merge de `getTenantBySlug()` es shallow POR CLAVE y sólo cubre `assets`:
 * cualquier clave presente acá gana ENTERA sobre `defaultConfig`. Por eso el
 * invariante que estos tests defienden es:
 *
 *   toda clave presente en el payload de la principal tiene que ser IGUAL a la de
 *   defaultConfig, o estar AUSENTE.
 *
 * Si no, publicar la fila le cambia el sitio al cliente principal.
 */

const mainRow = (over: Partial<DemoStoreLike> = {}): DemoStoreLike => ({
  id: MAIN_STORE_ID,
  is_main: true,
  name: 'Mercatto',
  slug: 'principal',
  template_code: 'supermercado',
  country_code: 'ar',
  currency_code: 'ars',
  locale: 'es',
  sales_channel_id: 'sc_default',
  theme: MAIN_STORE_THEME_SEED as unknown as DemoStoreLike['theme'],
  content_config: null,
  ...over,
});

const regularRow = (over: Partial<DemoStoreLike> = {}): DemoStoreLike => ({
  id: 'demo_1',
  name: 'Tienda Moda',
  slug: 'moda',
  template_code: 'supermercado',
  country_code: 'ar',
  currency_code: 'ars',
  locale: 'es',
  sales_channel_id: 'sc_moda',
  ...over,
});

describe('buildTenantConfig · tienda principal', () => {
  it('NO hereda la decoración del template', () => {
    const config = buildTenantConfig(mainRow());
    const templateKeys = Object.keys(supermercadoTemplate.buildAssets(mainRow()));
    const decoration = templateKeys.filter((k) => k !== 'logos' && k !== 'favicon');

    for (const key of decoration) {
      assert.equal(
        key in (config.assets as Record<string, unknown>),
        false,
        `assets.${key} viene del template y el merge del storefront es shallow: ` +
          `presente acá le pisaría al sitio principal su ${key} administrado.`
      );
    }
  });

  it('en particular, no le mete los heroBanners de demo', () => {
    // 'Nuestras verduras' / 'Promo TV' son banners hardcodeados del template
    // (supermercado.ts). El sitio principal tiene sus propios banners del admin.
    const json = JSON.stringify(buildTenantConfig(mainRow()));
    assert.equal(json.includes('demo-hero-1'), false);
    assert.equal(json.includes('Nuestras verduras'), false);
  });

  it('sin logo cargado NO emite `logos`, para que gane defaultConfig', () => {
    // `buildBaseAssets` caería a '/logo_full.webp', pero el sitio real usa
    // '/logos-mercatto/logocompleto-verde.svg'. Una clave ausente = gana el default.
    const config = buildTenantConfig(mainRow());
    assert.equal('logos' in (config.assets as Record<string, unknown>), false);
  });

  it('con logo cargado SÍ lo emite (la marca de la principal es editable)', () => {
    const config = buildTenantConfig(
      mainRow({ theme: { ...MAIN_STORE_THEME_SEED, logo: '/mi-logo.svg' } as any })
    );
    const logos = (config.assets as any).logos;
    assert.equal(logos.main, '/mi-logo.svg');
    assert.equal(logos.footer, '/mi-logo.svg');
  });

  it('una fila con la vieja `mobile_nav_icon` no emite nada: ni preferencia ni `logos`', () => {
    // La clave se retiró en DESDEELSUR-29 pero quedó guardada en filas reales.
    // Leerla otra vez volvería a apagar el isotipo de la barra mobile, así que
    // esto verifica que se ignora de punta a punta: no viaja como preferencia
    // y tampoco arrastra `logos` —que, por el merge shallow POR CLAVE, le
    // borraría al sitio principal sus logos por defecto.
    const config = buildTenantConfig(
      mainRow({ theme: { ...MAIN_STORE_THEME_SEED, mobile_nav_icon: 'negative' } as any })
    );
    assert.equal('mobileNavIcon' in (config.assets as Record<string, unknown>), false);
    assert.equal('logos' in (config.assets as Record<string, unknown>), false);
  });

  it('theme.colors reproduce el terceto de defaultConfig', () => {
    const config = buildTenantConfig(mainRow());
    assert.equal(config.theme.colors.primary, MAIN_STORE_THEME_SEED.primary_color);
    assert.equal(config.theme.colors.secondary, MAIN_STORE_THEME_SEED.secondary_color);
    assert.equal(config.theme.colors.accent, MAIN_STORE_THEME_SEED.accent_color);
  });

  it('template y vertical son "grocery", como defaultConfig', () => {
    const config = buildTenantConfig(mainRow());
    assert.equal(config.template, 'grocery');
    assert.equal(config.vertical, 'grocery');
  });

  it('metadata.description es byte-idéntica a la de defaultConfig', () => {
    // defaultConfig.metadata = { name: "Mercatto", description: "Tienda online de Mercatto" }
    const config = buildTenantConfig(mainRow());
    assert.equal(config.metadata?.name, 'Mercatto');
    assert.equal(config.metadata?.description, 'Tienda online de Mercatto');
  });

  it('las claves de assets están congeladas: agregar una es una decisión consciente', () => {
    // Cualquier clave nueva acá se le suma al sitio principal en el merge. Este
    // assert obliga a que aparezca en un diff en vez de colarse.
    assert.deepEqual(Object.keys(buildTenantConfig(mainRow()).assets as object).sort(), [
      'mercadopago',
    ]);
  });
});

describe('buildTenantConfig · isotipo del nav mobile', () => {
  it('la preferencia retirada no viaja, y las DOS variantes de isotipo sí', () => {
    // `mobileNavIcon` ya no existe: la barra mobile usa siempre el positivo.
    // Los assets no se tocan —`iconNegative` sigue expuesto para otros
    // consumidores— porque lo que se retiró fue la ELECCIÓN, no el archivo.
    const config = buildTenantConfig(
      regularRow({
        theme: {
          icon: '/iso.svg',
          icon_negative: '/iso-neg.svg',
          mobile_nav_icon: 'negative',
        } as any,
      })
    );
    assert.equal('mobileNavIcon' in (config.assets as Record<string, unknown>), false);
    assert.equal((config.assets as any).logos.mobile, '/iso.svg');
    assert.equal((config.assets as any).logos.iconNegative, '/iso-neg.svg');
  });

  it('el isotipo positivo es el que toma el botón de home', () => {
    const config = buildTenantConfig(regularRow({ theme: { icon: '/iso.svg' } as any }));
    assert.equal((config.assets as any).logos.mobile, '/iso.svg');
  });
});

describe('buildTenantConfig · orden de la barra inferior mobile', () => {
  it('la lista configurada pasa a `assets.mobileNav` tal cual', () => {
    const config = buildTenantConfig(
      regularRow({ content_config: { mobileNav: ['blog', 'promos'] } as any })
    );
    assert.deepEqual((config.assets as any).mobileNav, ['blog', 'promos']);
  });

  it('sin config no emite la clave: gana el default del storefront', () => {
    const config = buildTenantConfig(regularRow({ content_config: {} as any }));
    assert.equal('mobileNav' in (config.assets as Record<string, unknown>), false);
  });

  /**
   * El merge de `assets` es shallow POR CLAVE: un `mobileNav: []` presente le
   * ganaría entero al default del storefront y dejaría el lugar flexible sin
   * candidatos, o sea la barra en 4 columnas con el carrito descentrado.
   */
  it('una lista VACÍA no se emite', () => {
    const config = buildTenantConfig(
      regularRow({ content_config: { mobileNav: [] } as any })
    );
    assert.equal('mobileNav' in (config.assets as Record<string, unknown>), false);
  });

  it('la principal tampoco la emite si no la configuró', () => {
    const config = buildTenantConfig(mainRow());
    assert.equal('mobileNav' in (config.assets as Record<string, unknown>), false);
  });

  it('el ícono/texto por entrada pasa a `assets.mobileNavDisplay`', () => {
    const config = buildTenantConfig(
      regularRow({ content_config: { mobileNavDisplay: { blog: 'text' } } as any })
    );
    assert.deepEqual((config.assets as any).mobileNavDisplay, { blog: 'text' });
  });

  /** Igual que `mobileNav`: la clave presente gana entera, así que vacía no va. */
  it('un objeto VACÍO de ícono/texto no se emite', () => {
    const config = buildTenantConfig(
      regularRow({ content_config: { mobileNavDisplay: {} } as any })
    );
    assert.equal(
      'mobileNavDisplay' in (config.assets as Record<string, unknown>),
      false
    );
  });
});

describe('buildTenantConfig · footer.description', () => {
  it('la principal SIN descripción no emite `footer` (gana defaultConfig)', () => {
    // El invariante de arriba: una clave presente gana ENTERA sobre defaultConfig.
    // Emitirla vacía le borraría al sitio principal el newsletter y los legales.
    const config = buildTenantConfig(mainRow());
    assert.equal('footer' in (config.assets as Record<string, unknown>), false);
  });

  it('la principal CON descripción emite sólo esa subclave', () => {
    // `buildMainStoreBrandAssets` no aporta footer, así que acá sale sola. El resto
    // del footer lo repone `mergeMainTenant` en el storefront (merge por subclave).
    const config = buildTenantConfig(
      mainRow({ content_config: { footer: { description: 'Texto del backoffice' } } })
    );
    assert.deepEqual((config.assets as any).footer, {
      description: 'Texto del backoffice',
    });
  });

  it('en una demo se mergea SOBRE el footer del template', () => {
    // El template aporta el newsletter; la descripción editada sólo pisa el copy.
    const config = buildTenantConfig(
      regularRow({ content_config: { footer: { description: 'Mi texto' } } })
    );
    const templateFooter = supermercadoTemplate.buildAssets(regularRow()).footer as any;
    const footer = (config.assets as any).footer;
    assert.equal(footer.description, 'Mi texto');
    assert.deepEqual(footer.newsletter, templateFooter.newsletter);
  });

  it('convive con el contacto: las dos subclaves viajan juntas', () => {
    const config = buildTenantConfig(
      regularRow({
        content_config: {
          footer: { description: 'Mi texto' },
          contact: { phone: '+54 11 5555-5555' },
        },
      })
    );
    const footer = (config.assets as any).footer;
    assert.equal(footer.description, 'Mi texto');
    assert.equal(footer.contact.phone.value, '+54 11 5555-5555');
  });

  it('sólo contacto: la descripción sigue siendo la del template', () => {
    // Regresión del comportamiento previo, cuando `footer` sólo se emitía con
    // contacto cargado.
    const config = buildTenantConfig(
      regularRow({ content_config: { contact: { phone: '+54 11 5555-5555' } } })
    );
    const templateFooter = supermercadoTemplate.buildAssets(regularRow()).footer as any;
    assert.equal((config.assets as any).footer.description, templateFooter.description);
  });

  it('una descripción en blanco se trata como ausente', () => {
    // Si se persistiera '', la principal publicaría un párrafo vacío en lugar de
    // caer al copy por defecto.
    const config = buildTenantConfig(
      mainRow({ content_config: { footer: { description: '   ' } } })
    );
    assert.equal('footer' in (config.assets as Record<string, unknown>), false);
  });
});

describe('buildTenantConfig · copy de "Atención al cliente"', () => {
  it('sólo copy, sin datos de contacto: la clave igual se emite', () => {
    // ESTE es el caso que rompía antes: `contactPage` colgaba de `hasContact`
    // (teléfono/mail/dirección/horario), así que configurar únicamente el título
    // se guardaba en la fila y no llegaba nunca al storefront. Sin error.
    const config = buildTenantConfig(
      regularRow({ content_config: { contactPage: { title: 'Te ayudamos' } } })
    );
    assert.equal((config.assets as any).contactPage.title, 'Te ayudamos');
  });

  it('convive con los datos: copy y contacto viajan en la misma clave', () => {
    const config = buildTenantConfig(
      regularRow({
        content_config: {
          contactPage: { title: 'Te ayudamos', note: 'Sumá tu número de pedido' },
          contact: { phone: '+54 11 5555-5555', email: 'hola@tienda.com' },
        },
      })
    );
    const contactPage = (config.assets as any).contactPage;
    assert.equal(contactPage.title, 'Te ayudamos');
    assert.equal(contactPage.note, 'Sumá tu número de pedido');
    assert.equal(contactPage.phone.value, '+54 11 5555-5555');
    assert.equal(contactPage.email.value, 'hola@tienda.com');
  });

  it('un texto en blanco se trata como ausente', () => {
    // Emitir `title: ''` dejaría la tarjeta con el título vacío en vez de caer al
    // copy por defecto del storefront.
    const config = buildTenantConfig(
      mainRow({ content_config: { contactPage: { title: '   ', note: '' } } })
    );
    assert.equal('contactPage' in (config.assets as Record<string, unknown>), false);
  });

  it('sólo datos de contacto: no inventa copy', () => {
    // El copy por defecto vive en el storefront, no acá: emitirlo desde el backend
    // lo duplicaría en dos lugares que después se desincronizan.
    const config = buildTenantConfig(
      regularRow({ content_config: { contact: { phone: '+54 11 5555-5555' } } })
    );
    const contactPage = (config.assets as any).contactPage;
    assert.equal(contactPage.phone.value, '+54 11 5555-5555');
    assert.equal('title' in contactPage, false);
    assert.equal('description' in contactPage, false);
    assert.equal('note' in contactPage, false);
  });
});

describe('buildTenantConfig · canonicalForm', () => {
  it("default 'host': el subdominio es la forma canónica", () => {
    // Es el comportamiento que estaba hardcodeado antes de la columna, así que las
    // filas existentes (con la columna en NULL) no cambian de conducta.
    assert.equal(buildTenantConfig(regularRow()).canonicalForm, 'host');
    assert.equal(buildTenantConfig(regularRow({ canonical_form: null })).canonicalForm, 'host');
  });

  it("respeta 'path' cuando la tienda lo elige", () => {
    assert.equal(buildTenantConfig(regularRow({ canonical_form: 'path' })).canonicalForm, 'path');
  });

  it('se publica SIEMPRE, para que el storefront no tenga que consultarlo aparte', () => {
    // El storefront lo lee del tenant que YA tiene cargado. Si fuera opcional en el
    // payload, `getCanonicalOrigin()` tendría que ir a buscarlo, y eso terminaría
    // siendo I/O en el render de cada página — o peor, en el proxy.
    for (const row of [mainRow(), regularRow(), regularRow({ canonical_form: 'path' })]) {
      const form = buildTenantConfig(row).canonicalForm;
      assert.ok(
        form === 'host' || form === 'path',
        'canonicalForm tiene que estar presente y ser uno de los dos valores'
      );
    }
  });

  it('la tienda principal es host: se sirve en la raíz, no tiene forma con ruta', () => {
    assert.equal(buildTenantConfig(mainRow()).canonicalForm, 'host');
  });
});

describe('buildTenantConfig · el payload no dice "demo" en ningún lugar', () => {
  it('la fila principal no contiene el substring "Demo "', () => {
    assert.equal(JSON.stringify(buildTenantConfig(mainRow())).includes('Demo '), false);
  });

  it('una tienda común tampoco: son sitios de clientes reales', () => {
    // Antes: metadata.description = `Demo ${name} generada con Mercatto.` y
    // footer.description = `${name} — demo generada con Mercatto.`. Los dos se
    // renderizan en el sitio PÚBLICO del cliente.
    const json = JSON.stringify(buildTenantConfig(regularRow()));
    assert.equal(json.includes('generada con Mercatto'), false);
    assert.equal(json.includes('Demo '), false);
  });

  it('metadata.description respeta content_config.description cuando está', () => {
    const config = buildTenantConfig(
      regularRow({ content_config: { description: 'La mejor moda del país' } as any })
    );
    assert.equal(config.metadata?.description, 'La mejor moda del país');
  });

  it('sin description, cae a "Tienda online de {name}"', () => {
    assert.equal(
      buildTenantConfig(regularRow()).metadata?.description,
      'Tienda online de Tienda Moda'
    );
  });
});

describe('buildTenantConfig · template campaign — overrides SITE-LEVEL de content_config.campaign', () => {
  const campaignRow = (override: Partial<DemoStoreLike['content_config']> = {}): DemoStoreLike =>
    regularRow({
      id: 'demo_campaign_1',
      slug: 'escuela-tecnica-1',
      name: 'Escuela Técnica N°1',
      template_code: 'campaign',
      content_config: override as DemoStoreLike['content_config'],
    });

  it('sin content_config, el payload trae la ilustración genérica de campaign', () => {
    const cfg = buildTenantConfig(campaignRow());
    // El storefront conserva el resto de sus defaults y recibe una imagen
    // local de calidad aunque la campaña todavía no haya cargado una propia.
    const assets = cfg.assets as Record<string, unknown>;
    assert.equal('campaign' in assets, true);
    assert.deepEqual(assets.campaign, {
      hero: { image: '/images/campaign-default-illustration.png' },
    });
  });

  it('emite announcement/chrome sólo cuando el content los trae', () => {
    const cfg = buildTenantConfig(
      campaignRow({
        campaign: {
          announcement: { text: 'Tienda oficial de la escuela' },
        },
      } as any)
    );
    const assets = cfg.assets as Record<string, any>;
    assert.equal(assets.campaign.announcement.text, 'Tienda oficial de la escuela');
    // chrome NO se emite porque el content no lo tenía.
    assert.equal('chrome' in assets.campaign, false);
    // footer tampoco: no hay contact ni content.footer ni campaign.footer.
    assert.equal('footer' in assets.campaign, false);
  });

  it('strippea strings vacíos del announcement: no pisa defaults con ""', () => {
    // Si el operador vacía un input del admin, el form manda "".
    // El clean del backend tiene que descartarlo para que el default gane.
    const cfg = buildTenantConfig(
      campaignRow({
        campaign: {
          announcement: { text: '', href: 'https://example.com' },
        },
      } as any)
    );
    const assets = cfg.assets as Record<string, any>;
    // href sí, text no.
    assert.equal(assets.campaign.announcement.href, 'https://example.com');
    assert.equal('text' in assets.campaign.announcement, false);
  });

  it('assets.campaign.footer se ARMA desde content.contact + content.footer', () => {
    // Las 4 propiedades comunes del footer (email/phone/address/description/
    // copyright) salen ahora de las fuentes compartidas del site, no de un
    // 3er lugar en content_config.campaign.footer.
    const cfg = buildTenantConfig(
      campaignRow({
        contact: {
          email: 'hola@edu.ar',
          phone: '+54 11 5555-5555',
          address: 'Av. Siempre Viva 1234',
        },
        footer: {
          description: 'Tienda de kits educativos',
          copyright: '© 2026 Escuela',
        },
      } as any)
    );
    const assets = cfg.assets as Record<string, any>;
    assert.equal(assets.campaign.footer.email, 'hola@edu.ar');
    assert.equal(assets.campaign.footer.phone, '+54 11 5555-5555');
    assert.equal(assets.campaign.footer.address, 'Av. Siempre Viva 1234');
    assert.equal(assets.campaign.footer.description, 'Tienda de kits educativos');
    assert.equal(assets.campaign.footer.copyright, '© 2026 Escuela');
  });

  it('el footer del vertical mergea poweredBy/backgroundColor sobre las fuentes compartidas', () => {
    // `poweredBy` y `backgroundColor` son propios del template Campaña y siguen
    // viviendo en content.campaign.footer. Conviven con las 4 propiedades
    // que ahora salen de las fuentes compartidas.
    const cfg = buildTenantConfig(
      campaignRow({
        contact: { email: 'hola@edu.ar' },
        campaign: {
          footer: {
            poweredBy: { label: 'Powered by X', href: 'https://x.com' },
            backgroundColor: '#0f1114',
          },
        },
      } as any)
    );
    const assets = cfg.assets as Record<string, any>;
    assert.equal(assets.campaign.footer.email, 'hola@edu.ar');
    assert.deepEqual(assets.campaign.footer.poweredBy, {
      label: 'Powered by X',
      href: 'https://x.com',
    });
    assert.equal(assets.campaign.footer.backgroundColor, '#0f1114');
  });

  it('strings en blanco en las fuentes compartidas se tratan como ausentes', () => {
    // Como en el resto del payload: `""` en un input del admin no pisa el
    // default con vacío — la sub-clave desaparece.
    const cfg = buildTenantConfig(
      campaignRow({
        contact: { email: '   ', address: 'Av. Siempre Viva 1234' },
        footer: { description: '', copyright: '© 2026' },
      } as any)
    );
    const assets = cfg.assets as Record<string, any>;
    assert.equal(assets.campaign.footer.address, 'Av. Siempre Viva 1234');
    assert.equal(assets.campaign.footer.copyright, '© 2026');
    assert.equal('email' in assets.campaign.footer, false);
    assert.equal('description' in assets.campaign.footer, false);
  });

  it('un template distinto NUNCA emite assets.campaign, aunque el content lo tenga', () => {
    // Emitirlo sería confuso: el storefront lee `assets.campaign` sólo cuando
    // template === 'campaign'. Ensuciarlo en, p.ej., grocery es ruido inútil.
    const cfg = buildTenantConfig(
      regularRow({
        template_code: 'supermercado',
        content_config: {
          contact: { email: 'no@debe.aparecer' },
          campaign: { footer: { backgroundColor: '#000' } },
        } as any,
      })
    );
    const assets = cfg.assets as Record<string, unknown>;
    // supermercadoTemplate.buildAssets no siembra la clave; buildTenantConfig
    // tampoco la propaga porque tenant_template !== 'campaign'.
    assert.equal('campaign' in assets, false);
  });

  it('el hero y el grid de kits NO viven en content_config.campaign (son bloques Puck)', () => {
    // El editor Puck del site guarda su documento en `demo.home_puck_data` y
    // se expone como `assets.homeLayout`. El content_config.campaign es
    // SITE-LEVEL: no debería aceptar hero ni kits, y si alguien los mandara
    // (por API directa), el schema Zod los stripearía y el clean del backend
    // no los alcanzaría acá porque no hay branch que los emita.
    const cfg = buildTenantConfig(
      campaignRow({
        // Simulamos un client que mande claves NO modeladas por el schema.
        // Zod las stripea antes de llegar a esta función, pero por defensa el
        // build tampoco tiene rama que las emita.
        campaign: {
          announcement: { text: 'OK' },
        } as any,
      })
    );
    const assets = cfg.assets as Record<string, any>;
    assert.equal('hero' in assets.campaign, false);
    assert.equal('kits' in assets.campaign, false);
  });
});

describe('buildTenantConfig · la principal sigue sin filtrar la contraseña', () => {
  it('no publica password_gate_password ni con el gate prendido', () => {
    // El gate de la principal vive en el scope `store`, pero si alguien le escribiera
    // las columnas planas el payload igual no puede filtrar la palabra.
    const config = buildTenantConfig(
      mainRow({ password_gate_enabled: true, password_gate_password: 'secreta1' })
    );
    assert.equal(JSON.stringify(config).includes('secreta1'), false);
  });
});

describe('main store B2B configuration', () => {
  it('does not advertise an unprovisioned main wholesale portal', () => {
    assert.equal(buildTenantConfig(mainRow({ b2b_enabled: true })).medusa.b2b, undefined);
  });
  it('preserves explicit custom pricing without applying demo discounts', () => {
    const config = buildTenantConfig(
      mainRow({ b2b_enabled: true, b2b_sales_channel_id: 'sc_b2b', b2b_pricing_tiers: [] })
    );
    assert.deepEqual(config.medusa.b2b?.tiers, []);
  });
  it('preserves an assigned wholesale channel', () => {
    const config = buildTenantConfig(
      mainRow({ b2b_enabled: true, b2b_sales_channel_id: 'sc_wholesale' })
    );
    assert.equal(config.medusa.b2b?.salesChannelId, 'sc_wholesale');
  });
  it('keeps demo tiers and requires a provisioned channel for demos', () => {
    assert.equal(buildTenantConfig(regularRow({ b2b_enabled: true })).medusa.b2b, undefined);
    const config = buildTenantConfig(
      regularRow({ b2b_enabled: true, b2b_sales_channel_id: 'sc_demo_b2b' })
    );
    assert.equal(config.medusa.b2b?.tiers?.length, 3);
  });
});
