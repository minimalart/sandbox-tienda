import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultConfig } from "./default.ts";
import { buildPwaBrand } from "./pwa-brand.ts";
import type { TenantConfig } from "./types.ts";

/**
 * El bug que fija este test: el storefront servía el manifest ESTÁTICO de la app del
 * repartidor (`public/manifest.json`), así que cualquier tienda —en cualquier host—
 * le ofrecía al comprador "Instalar Mercatto Repartidores" con el ícono de Mercatto.
 *
 * Lo que se vigila acá es la parte que puede volver a romperse en silencio: que la
 * marca del manifest salga del TENANT y que los assets que vienen de `defaultConfig`
 * (los del boilerplate, que un tenant sin branding hereda por el merge de
 * `getActiveTenant`) NO se sirvan como si fueran el ícono de la tienda.
 */

const tenant = (over: Partial<TenantConfig> = {}): TenantConfig =>
  ({
    ...defaultConfig,
    ...over,
    assets: { ...defaultConfig.assets, ...(over.assets ?? {}) },
  }) as TenantConfig;

describe("la marca del manifest sale del tenant", () => {
  it("usa el nombre y el color de la tienda, no los del boilerplate", () => {
    const brand = buildPwaBrand(
      tenant({
        name: "Vital",
        theme: { ...defaultConfig.theme, colors: { primary: "#123456" } },
      }),
      "",
    );

    assert.equal(brand.name, "Vital");
    assert.equal(brand.themeColor, "#123456");
  });

  it("la descripción prefiere la de SEO y cae a uno armado con la marca", () => {
    const conSeo = buildPwaBrand(
      tenant({
        name: "Vital",
        metadata: { name: "Vital", seo: { description: "Almacén natural" } },
      }),
      "",
    );
    assert.equal(conSeo.description, "Almacén natural");

    // `defaultConfig.metadata` trae la descripción del boilerplate, así que el caso
    // "sin nada cargado" se construye con metadata vacía a propósito.
    const sinNada = buildPwaBrand(tenant({ name: "Vital", metadata: undefined }), "");
    assert.equal(sinNada.description, "Tienda online de Vital");
  });

  it("el short_name entra abajo del ícono: corta por palabra, no al medio", () => {
    assert.equal(buildPwaBrand(tenant({ name: "Vital" }), "").shortName, "Vital");
    assert.equal(
      buildPwaBrand(tenant({ name: "Desde el Sur Distribuidora" }), "").shortName,
      "Desde",
    );
  });

  it("bajo /tienda/<slug> la app instalada abre la home de ESA tienda", () => {
    assert.equal(buildPwaBrand(tenant(), "/tienda/vital").prefix, "/tienda/vital");
  });
});

describe("el ícono sale del favicon de la tienda", () => {
  it("manda el favicon —el mismo que la pestaña— con su mime por extensión", () => {
    const { icons } = buildPwaBrand(
      tenant({
        assets: {
          ...defaultConfig.assets,
          logos: { main: "https://cdn/logo.svg", mobile: "https://cdn/iso.webp" },
          favicon: "https://cdn/favicon.png",
        },
      }),
      "",
    );

    assert.deepEqual(icons, [
      { src: "https://cdn/favicon.png", sizes: "any", purpose: "any", type: "image/png" },
    ]);
  });

  it("sin favicon propio cae al isotipo, y sin isotipo al logo", () => {
    const conIsotipo = buildPwaBrand(
      tenant({
        assets: {
          ...defaultConfig.assets,
          logos: { main: "https://cdn/logo.svg", mobile: "https://cdn/iso.webp" },
        },
      }),
      "",
    );
    assert.equal(conIsotipo.icons?.[0]?.src, "https://cdn/iso.webp");
    assert.equal(conIsotipo.icons?.[0]?.type, "image/webp");

    const soloLogo = buildPwaBrand(
      tenant({
        assets: { ...defaultConfig.assets, logos: { main: "https://cdn/logo.svg" } },
      }),
      "",
    );
    assert.equal(soloLogo.icons?.[0]?.src, "https://cdn/logo.svg");
    assert.equal(soloLogo.icons?.[0]?.type, "image/svg+xml");
  });

  it("los assets heredados de defaultConfig NO cuentan como marca de la tienda", () => {
    // Este es el caso real: una tienda sin branding propio recibe `/favicon.ico` y
    // `/logo_full.webp` por el merge. Servirlos sería volver a instalar la marca del
    // boilerplate en el teléfono del cliente — y encima con un `.ico` de 32px.
    const { icons } = buildPwaBrand(tenant({ name: "Vital" }), "");

    assert.deepEqual(
      icons?.map((icon) => icon.src),
      ["/android-chrome-192x192.png", "/android-chrome-512x512.png"],
    );
  });

  it("un asset sin extensión conocida va sin `type` (y no rompe)", () => {
    const { icons } = buildPwaBrand(
      tenant({
        assets: {
          ...defaultConfig.assets,
          logos: { main: "https://cdn/imagen?id=7" },
          favicon: undefined,
        },
      }),
      "",
    );

    assert.equal(icons?.[0]?.src, "https://cdn/imagen?id=7");
    assert.equal(icons?.[0]?.type, undefined);
  });
});
