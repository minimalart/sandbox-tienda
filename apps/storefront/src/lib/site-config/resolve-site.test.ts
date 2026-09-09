import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalHostFor,
  normalizeHost,
  resolveHostSlug,
  resolveSiteFromParts,
  SITE_HOME_ROUTE_SEGMENT,
} from "./resolve-site.ts";

/**
 * `resolveSiteFromParts` decide, en TODA navegación, qué sitio es y hacia dónde
 * reescribe el proxy. Un error acá no se ve en una pantalla: sirve el catálogo de un
 * cliente en el dominio de otro, o deja una tienda en 404.
 *
 * Es una función pura sobre `(host, pathname, cookie, exit)` justamente para poder
 * tener esta tabla.
 */

const r = (parts: Parameters<typeof resolveSiteFromParts>[0]) => resolveSiteFromParts(parts);

describe("precedencia", () => {
  it("el path gana sobre la cookie", () => {
    const out = r({ pathname: "/tienda/moda", cookieSlug: "zapatos" });
    assert.equal(out.slug, "moda");
    assert.equal(out.source, "path");
  });

  it("sin path, la cookie sostiene la sesión en una sub-ruta", () => {
    const out = r({ pathname: "/store", cookieSlug: "moda" });
    assert.equal(out.slug, "moda");
    assert.equal(out.source, "cookie");
  });

  it("sin nada, es el sitio principal", () => {
    const out = r({ pathname: "/store" });
    assert.equal(out.slug, null);
    assert.equal(out.source, "none");
    assert.equal(out.pathPrefix, "");
  });
});

describe("salidas de sesión", () => {
  it("la home raíz siempre sale del sitio, aunque haya cookie", () => {
    const out = r({ pathname: "/", cookieSlug: "moda" });
    assert.equal(out.slug, null);
    assert.equal(out.isExit, true);
  });

  it("?exit_site sale", () => {
    const out = r({ pathname: "/store", cookieSlug: "moda", exitRequested: true });
    assert.equal(out.slug, null);
    assert.equal(out.isExit, true);
  });

  it("?exit_demo TAMBIÉN sale: lo emite el backend y no se puede renombrar", () => {
    // `modules/ai-assistant/ai/native-tools/index.ts:423` construye
    // `?preview=1&exit_demo=1`. El caller es el backend, así que el alias es para
    // siempre. Acá se testea el contrato del resolver: `exitRequested` cubre los dos.
    const out = r({ pathname: "/store", cookieSlug: "moda", exitRequested: true });
    assert.equal(out.isExit, true);
  });

  it("un path de sitio explícito NO sale, aunque venga ?exit", () => {
    // La URL es la intención más fuerte: si pediste /tienda/moda, querés moda.
    const out = r({ pathname: "/tienda/moda", exitRequested: true });
    assert.equal(out.slug, "moda");
    assert.equal(out.isExit, false);
  });
});

describe("rewritePath — la corrección que evita el 404 de la home", () => {
  it("la HOME de un sitio se reconstruye al folder real, no se pasa tal cual", () => {
    // El proxy viejo pasaba `pathname` derecho y funcionaba PORQUE la URL pública ya
    // era /demo/{slug}. Con /tienda/{slug} eso daría /{cc}/tienda/{slug} → 404.
    const out = r({ pathname: "/tienda/moda" });
    assert.equal(out.rewritePath, `/${SITE_HOME_ROUTE_SEGMENT}/moda`);
    assert.equal(out.rewritePath, "/demo/moda");
  });

  it("una sub-ruta stripea el prefijo para reusar las rutas existentes", () => {
    assert.equal(r({ pathname: "/tienda/moda/store" }).rewritePath, "/store");
    assert.equal(
      r({ pathname: "/tienda/moda/products/zapato" }).rewritePath,
      "/products/zapato",
    );
  });

  it("la forma legacy reescribe igual (el 308 es aparte)", () => {
    assert.equal(r({ pathname: "/demo/moda" }).rewritePath, "/demo/moda");
    assert.equal(r({ pathname: "/demo/moda/cart" }).rewritePath, "/cart");
  });

  it("en modo cookie el path no se toca", () => {
    assert.equal(r({ pathname: "/store", cookieSlug: "moda" }).rewritePath, "/store");
  });

  it("el sitio principal no se toca", () => {
    assert.equal(r({ pathname: "/store" }).rewritePath, "/store");
    assert.equal(r({ pathname: "/" }).rewritePath, "/");
  });
});

describe("308 de la forma legacy", () => {
  it("/demo/<slug> se marca como legacy", () => {
    assert.equal(r({ pathname: "/demo/moda" }).isLegacyPath, true);
    assert.equal(r({ pathname: "/demo/moda/store" }).isLegacyPath, true);
  });

  it("/tienda/<slug> no", () => {
    assert.equal(r({ pathname: "/tienda/moda" }).isLegacyPath, false);
  });
});

describe("pathPrefix — el mecanismo que vuelve no-op los call sites", () => {
  it("por path y por cookie lleva prefijo", () => {
    assert.equal(r({ pathname: "/tienda/moda" }).pathPrefix, "/tienda/moda");
    assert.equal(r({ pathname: "/store", cookieSlug: "moda" }).pathPrefix, "/tienda/moda");
  });

  it("el prefijo es SIEMPRE la forma canónica, incluso entrando por la legacy", () => {
    // Así los links generados ya apuntan a /tienda/… y el 308 sólo se paga una vez.
    assert.equal(r({ pathname: "/demo/moda" }).pathPrefix, "/tienda/moda");
  });

  it("el sitio principal no lleva prefijo", () => {
    assert.equal(r({ pathname: "/store" }).pathPrefix, "");
  });
});

describe("slugs inválidos NO se toman como sitio", () => {
  it("un slug de 2 letras se rechaza (choca con el prefijo legacy de país)", () => {
    const out = r({ pathname: "/tienda/bo" });
    assert.equal(out.slug, null, "'bo' tiene 2 caracteres: fuera por largo mínimo");
  });

  it("un segmento reservado no puede ser slug", () => {
    for (const reserved of ["store", "cart", "checkout", "account", "www", "api", "principal"]) {
      assert.equal(
        r({ pathname: `/tienda/${reserved}` }).slug,
        null,
        `'${reserved}' está reservado`,
      );
    }
  });

  it("mayúsculas, guiones dobles y puntos se rechazan", () => {
    for (const bad of ["Moda", "a--b", "-moda", "moda-", "moda.tienda"]) {
      assert.equal(r({ pathname: `/tienda/${bad}` }).slug, null, `'${bad}' es inválido`);
    }
  });

  it("/tiendas sin slug es el sitio principal, no un sitio roto", () => {
    assert.equal(r({ pathname: "/tiendas" }).slug, null);
  });

  it("una cookie con un slug inválido se ignora", () => {
    // Defensa: una cookie vieja o manipulada no puede meter un slug ilegal.
    assert.equal(r({ pathname: "/store", cookieSlug: "STORE" }).slug, null);
    assert.equal(r({ pathname: "/store", cookieSlug: "bo" }).slug, null);
  });
});

describe("normalizeHost", () => {
  it("baja a minúsculas, saca el puerto y el punto final", () => {
    assert.equal(normalizeHost("Moda.Ejemplo.COM:3000"), "moda.ejemplo.com");
    assert.equal(normalizeHost("moda.ejemplo.com."), "moda.ejemplo.com");
  });

  it("null/vacío → null", () => {
    assert.equal(normalizeHost(null), null);
    assert.equal(normalizeHost("   "), null);
  });
});

describe("resolveHostSlug — inactivo hasta la Fase 6", () => {
  const original = process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX;
  after(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX;
    else process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = original;
  });

  it("sin el sufijo configurado devuelve null SIEMPRE — todo el código nuevo es no-op", () => {
    // Es la restricción de diseño que permite mergear esto sin coordinar deploys: los
    // subdominios se prenden con una env var, y el rollback es borrarla.
    delete process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX;
    assert.equal(resolveHostSlug("moda.ejemplo.com"), null);
    assert.equal(r({ host: "moda.ejemplo.com", pathname: "/store" }).source, "none");
  });

  it("con el sufijo, el primer label es el slug", () => {
    process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = ".ejemplo.com";
    assert.equal(resolveHostSlug("moda.ejemplo.com"), "moda");
  });

  it("el host principal (sin label) NO resuelve un sitio", () => {
    process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = ".ejemplo.com";
    assert.equal(resolveHostSlug("ejemplo.com"), null);
  });

  it("www y los subdominios de infra no son sitios", () => {
    process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = ".ejemplo.com";
    for (const label of ["www", "api", "admin", "staging", "mail"]) {
      assert.equal(resolveHostSlug(`${label}.ejemplo.com`), null, label);
    }
  });

  it("dos niveles de label NO resuelven: el wildcard de un label no los cubre", () => {
    // `*.ejemplo.com` cubre `moda.ejemplo.com` pero no `www.moda.ejemplo.com`: falla
    // en TLS antes de llegar acá. No documentar una vía que no existe.
    process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = ".ejemplo.com";
    assert.equal(resolveHostSlug("www.moda.ejemplo.com"), null);
  });

  it("un host de otro dominio no resuelve", () => {
    process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = ".ejemplo.com";
    assert.equal(resolveHostSlug("moda.otracosa.com"), null);
    assert.equal(resolveHostSlug("preview-abc.vercel.app"), null);
  });

  it("EL HOST GANA e IGNORA la cookie por completo", () => {
    // Una cookie perdida no puede secuestrar un host: si navegaste `moda` y abrís
    // `zapatos`, tenés que ver zapatos.
    process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = ".ejemplo.com";
    const out = r({ host: "zapatos.ejemplo.com", pathname: "/store", cookieSlug: "moda" });
    assert.equal(out.slug, "zapatos");
    assert.equal(out.source, "host");
  });

  it("bajo host NO hay prefijo: los call sites se vuelven no-op solos", () => {
    process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = ".ejemplo.com";
    assert.equal(r({ host: "moda.ejemplo.com", pathname: "/store" }).pathPrefix, "");
  });

  it("bajo host, `/` es la home DEL SITIO y no sale de la sesión", () => {
    // Trampa: sin este gate, la home de cada tienda borraría su propia cookie y
    // renderizaría con el branding del principal.
    process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = ".ejemplo.com";
    const out = r({ host: "moda.ejemplo.com", pathname: "/" });
    assert.equal(out.slug, "moda");
    assert.equal(out.isExit, false);
    assert.equal(out.rewritePath, "/demo/moda");
  });

  it("bajo host, un ?exit_demo perdido tampoco saca de la tienda", () => {
    process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = ".ejemplo.com";
    const out = r({ host: "moda.ejemplo.com", pathname: "/store", exitRequested: true });
    assert.equal(out.slug, "moda");
    assert.equal(out.isExit, false);
  });
});

describe("canonicalHostFor", () => {
  const suffix = process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX;
  after(() => {
    if (suffix === undefined) delete process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX;
    else process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = suffix;
  });

  it("null sin multi-host", () => {
    delete process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX;
    assert.equal(canonicalHostFor("moda"), null);
  });

  it("con multi-host, arma <slug><sufijo>", () => {
    process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = ".sites.ejemplo.com";
    assert.equal(canonicalHostFor("moda"), "moda.sites.ejemplo.com");
  });

  it("un slug con el sufijo ya puesto no se duplica", () => {
    // Defensa contra un caller que pase el host entero en vez del slug.
    process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX = ".sites.ejemplo.com";
    assert.notEqual(
      canonicalHostFor("moda"),
      "moda.sites.ejemplo.com.sites.ejemplo.com",
    );
  });
});

describe("el proxy NO 308ea al host canónico — decisión de diseño", () => {
  it("resolve-site no exporta ninguna función de redirect al canónico", async () => {
    // Cada tienda elige su forma canónica (columna `canonical_form`), así que para
    // saber en qué dirección redirigir el proxy tendría que LEER LA FILA — o sea I/O
    // en el camino caliente de toda navegación, que es exactamente lo que se descartó
    // al rechazar el slug en la raíz.
    //
    // La canonicalización se hace donde el tenant YA está cargado: el canonical tag
    // (`lib/util/site-url.ts`) y el `noindex` de `robots`. Este test es el guard de que
    // nadie reintroduzca el redirect en el proxy "porque falta".
    const mod = await import("./resolve-site.ts");
    assert.equal(
      "shouldRedirectToCanonicalHost" in mod,
      false,
      "volvió una función de redirect al canónico: eso exige leer canonical_form " +
        "desde el proxy, o sea I/O en cada navegación. La canonicalización va en la " +
        "capa de página, donde el tenant ya está cargado.",
    );
  });
});

for (const pathname of ['/b2b', '/b2b/login', '/b2b/pedidos', '/ar/b2b']) {
  it('root wholesale route ignores a stale child cookie: ' + pathname, () => {
    const site = r({ pathname, cookieSlug: 'fashion' });
    assert.equal(site.slug, null); assert.equal(site.pathPrefix, ''); assert.equal(site.isExit, true);
  });
}
it('a child wholesale route preserves explicit child context', () => {
  const site = r({ pathname: '/tienda/fashion/b2b', cookieSlug: 'other' });
  assert.equal(site.slug, 'fashion'); assert.equal(site.pathPrefix, '/tienda/fashion');
});
