import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeDefined, mergeMainTenant } from "./main-tenant.ts";
import type { TenantConfig } from "./types.ts";

/**
 * Este merge decide qué ve el SITIO PRINCIPAL. Un error acá no rompe una demo
 * desechable: le cambia el sitio al cliente principal, o lo deja sin login.
 */

const base = (): TenantConfig =>
  ({
    id: "storefront",
    domains: ["localhost"],
    name: "Mercatto",
    template: "grocery",
    vertical: "grocery",
    medusa: {
      salesChannelId: "sc_default",
      customerGroupId: "cg_default",
      publishableKey: "pk_default",
    },
    theme: {
      colors: { primary: "#2e7d32", secondary: "#374151", accent: "#f97316" },
    },
    assets: {
      logos: { main: "/logos-mercatto/logocompleto-verde.svg" },
      heroBanners: { carousel: [{ id: "real-1" }] },
      footer: { description: "footer real" },
    },
    metadata: { name: "Mercatto", description: "Tienda online de Mercatto" },
  }) as unknown as TenantConfig;

/** Lo que emite `buildTenantConfig(filaPrincipal)` con la semilla y sin overrides. */
const payload = (over: Record<string, unknown> = {}): TenantConfig =>
  ({
    id: "demo_main",
    domains: [],
    name: "Mercatto",
    template: "grocery",
    vertical: "grocery",
    medusa: { salesChannelId: "sc_default" },
    theme: {
      colors: {
        primary: "#2e7d32",
        secondary: "#374151",
        accent: "#f97316",
        // El backend las emite PRESENTES con undefined.
        headerBackground: undefined,
        footerBackground: undefined,
      },
      typography: undefined,
    },
    assets: { mercadopago: { checkoutMode: "express", publicKey: null } },
    metadata: { name: "Mercatto", description: "Tienda online de Mercatto" },
    ...over,
  }) as unknown as TenantConfig;

describe("mergeDefined", () => {
  it("un undefined explícito NO pisa el default", () => {
    // La trampa: `{...{a:1}, ...{a: undefined}}` da `{a: undefined}`.
    assert.deepEqual(mergeDefined({ a: 1, b: 2 }, { a: undefined }), { a: 1, b: 2 });
  });

  it("un valor definido sí pisa", () => {
    assert.deepEqual(mergeDefined({ a: 1 }, { a: 9 }), { a: 9 });
  });

  it("null SÍ pisa (es un valor, no una ausencia)", () => {
    assert.deepEqual(mergeDefined({ a: 1 } as Record<string, unknown>, { a: null }), { a: null });
  });

  it("sin override devuelve la base", () => {
    const b = { a: 1 };
    assert.deepEqual(mergeDefined(b, undefined), b);
    assert.deepEqual(mergeDefined(b, null), b);
  });
});

describe("mergeMainTenant · el invariante del login", () => {
  it("id se queda en el de defaultConfig, NUNCA el de la fila", () => {
    // `tenant.id` se guarda en `customer.metadata.tenant_ids` y el login rechaza si
    // el tenant actual no está en ese array (auth/route.ts:343). Con 'demo_main' acá,
    // TODO cliente existente del sitio principal queda afuera de su cuenta.
    const merged = mergeMainTenant(base(), payload());
    assert.equal(merged.id, "storefront");
    assert.notEqual(merged.id, "demo_main");
  });

  it("ni siquiera un payload que insista con otro id lo cambia", () => {
    const merged = mergeMainTenant(base(), payload({ id: "cualquier_cosa" }));
    assert.equal(merged.id, "storefront");
  });
});

describe("mergeMainTenant · medusa", () => {
  it("conserva publishableKey y customerGroupId, que el backend no manda", () => {
    // `TenantConfigPayload.medusa` no tiene esos campos: son globales de build. Un
    // spread normal los borraría y todo /store/* daría 400.
    const merged = mergeMainTenant(base(), payload());
    assert.equal(merged.medusa.publishableKey, "pk_default");
    assert.equal(merged.medusa.customerGroupId, "cg_default");
  });

  it("el salesChannelId de la fila sí gana", () => {
    const merged = mergeMainTenant(base(), payload({ medusa: { salesChannelId: "sc_fila" } }));
    assert.equal(merged.medusa.salesChannelId, "sc_fila");
  });
});

describe("mergeMainTenant · theme", () => {
  it("los colores undefined del payload no borran los del default", () => {
    const merged = mergeMainTenant(base(), payload());
    assert.equal(merged.theme.colors.primary, "#2e7d32");
    assert.equal(merged.theme.colors.secondary, "#374151");
    assert.equal(merged.theme.colors.accent, "#f97316");
  });

  it("un color definido en la fila sí pisa", () => {
    const merged = mergeMainTenant(
      base(),
      payload({ theme: { colors: { primary: "#123456" } } }),
    );
    assert.equal(merged.theme.colors.primary, "#123456");
    // Y el resto del terceto sobrevive.
    assert.equal(merged.theme.colors.accent, "#f97316");
  });
});

describe("mergeMainTenant · assets", () => {
  it("una clave AUSENTE en el payload deja ganar al default", () => {
    // Es el mecanismo entero: el backend deja fuera `logos`/`heroBanners`/`footer`
    // para la principal justamente porque este merge es shallow por clave.
    const merged = mergeMainTenant(base(), payload());
    assert.deepEqual((merged.assets as any).logos, {
      main: "/logos-mercatto/logocompleto-verde.svg",
    });
    assert.deepEqual((merged.assets as any).heroBanners, { carousel: [{ id: "real-1" }] });
    assert.deepEqual((merged.assets as any).footer, { description: "footer real" });
  });

  it("una clave presente en el payload gana ENTERA", () => {
    const merged = mergeMainTenant(
      base(),
      payload({ assets: { logos: { main: "/mi-logo.svg" } } }),
    );
    assert.deepEqual((merged.assets as any).logos, { main: "/mi-logo.svg" });
  });

  it("footer: la subclave editada gana y el RESTO del footer sobrevive", () => {
    // El backoffice edita sólo `footer.description`, así que el payload de la
    // principal llega con esa única subclave. Con el shallow por clave, editar la
    // descripción borraba el newsletter/contacto/legales del default y el
    // componente caía en sus fallbacks — que traen un teléfono INVENTADO.
    const withFullFooter = base();
    (withFullFooter.assets as any).footer = {
      description: "footer real",
      newsletter: { title: "Newsletter", buttonText: "Suscribirme" },
      contact: { email: { label: "Correo", value: "hola@mercatto.com" } },
      legal: [{ name: "Términos", href: "/legal/conditions" }],
    };
    const merged = mergeMainTenant(
      withFullFooter,
      payload({ assets: { footer: { description: "el texto del backoffice" } } }),
    );
    assert.deepEqual((merged.assets as any).footer, {
      description: "el texto del backoffice",
      newsletter: { title: "Newsletter", buttonText: "Suscribirme" },
      contact: { email: { label: "Correo", value: "hola@mercatto.com" } },
      legal: [{ name: "Términos", href: "/legal/conditions" }],
    });
  });

  it("footer: el contacto del payload gana sobre el del default", () => {
    // El backend emite `footer.contact` completo cuando la fila tiene datos de
    // contacto; ese objeto reemplaza el del default, no se fusiona con él.
    const merged = mergeMainTenant(
      base(),
      payload({
        assets: {
          footer: { contact: { phone: { label: "Teléfono", value: "+54 9 11" } } },
        },
      }),
    );
    assert.deepEqual((merged.assets as any).footer, {
      description: "footer real",
      contact: { phone: { label: "Teléfono", value: "+54 9 11" } },
    });
  });

  it("las claves nuevas del payload se suman", () => {
    const merged = mergeMainTenant(base(), payload());
    assert.deepEqual((merged.assets as any).mercadopago, {
      checkoutMode: "express",
      publicKey: null,
    });
  });
});

describe("mergeMainTenant · homeLayout", () => {
  it("el documento del editor sobrevive el merge del tenant principal", () => {
    // Es toda la cadena de la home editable del sitio principal:
    // `demo_store.home_puck_data` → `assets.homeLayout` → este merge → el guard
    // de `(main)/page.tsx`. Si el merge lo perdiera, guardar en el editor no
    // tendría ningún efecto visible y no habría error en ningún lado.
    const homeLayout = { content: [{ type: "Banners", props: { id: "b1" } }] };
    const merged = mergeMainTenant(base(), payload({ assets: { homeLayout } }));
    assert.deepEqual((merged.assets as any).homeLayout, homeLayout);
  });

  it("sin documento la clave no aparece, y el guard no se dispara", () => {
    // La ausencia es lo que mantiene la home hardcodeada. Un `{}` acá haría que
    // `homeLayout?.content` fuese undefined igual, pero el contrato que le
    // importa a la página es que la clave no exista.
    const merged = mergeMainTenant(base(), payload());
    assert.equal((merged.assets as any).homeLayout, undefined);
  });
});

describe("mergeMainTenant · el resto del payload", () => {
  it("template y vertical siguen siendo grocery", () => {
    const merged = mergeMainTenant(base(), payload());
    assert.equal(merged.template, "grocery");
    assert.equal(merged.vertical, "grocery");
  });

  it("metadata.description sale byte-idéntica a la del default", () => {
    const merged = mergeMainTenant(base(), payload());
    assert.equal(merged.metadata?.description, "Tienda online de Mercatto");
  });

  it("el payload nunca dice 'Demo '", () => {
    assert.equal(JSON.stringify(mergeMainTenant(base(), payload())).includes("Demo "), false);
  });
});
