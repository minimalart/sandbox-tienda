import type { MetadataRoute } from "next";
import { defaultConfig } from "./default";
import type { TenantConfig } from "./types";

type ManifestIcons = NonNullable<MetadataRoute.Manifest["icons"]>;

/**
 * Íconos que trae el boilerplate en `public/`.
 *
 * Son la marca del boilerplate, igual que `defaultConfig.assets`, pero a diferencia
 * de un favicon `.ico` o de un logo apaisado ESTOS están al tamaño que la PWA pide
 * (192 y 512 cuadrados). Por eso son el fallback y no un candidato más: se usan
 * cuando la tienda no cargó ningún asset propio, que es exactamente el caso en el que
 * la marca del boilerplate es la respuesta correcta.
 */
const BOILERPLATE_ICONS: ManifestIcons = [
  {
    src: "/android-chrome-192x192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
  },
  {
    src: "/android-chrome-512x512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "any",
  },
];

/**
 * Assets que vienen en `defaultConfig` — o sea, "esta tienda no cargó marca propia".
 *
 * `getActiveTenant()` mergea los assets de la tienda SOBRE `defaultConfig`, así que un
 * tenant sin favicon propio igual devuelve `/favicon.ico` y un tenant sin isotipo
 * devuelve `/logo_full.webp`. Tomarlos como "el ícono de la tienda" es justamente el
 * bug que se está arreglando: la PWA se instalaría con la marca del boilerplate en el
 * teléfono de un cliente. Si el asset es uno de estos, no cuenta como marca cargada.
 */
const BOILERPLATE_ASSETS: ReadonlySet<string> = new Set(
  [
    defaultConfig.assets.favicon,
    defaultConfig.assets.logos.main,
    defaultConfig.assets.logos.footer,
    defaultConfig.assets.logos.mobile,
  ].filter((value): value is string => Boolean(value)),
);

const MIME_BY_EXTENSION: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

/** `type` del ícono a partir de la extensión. Ausente si no se reconoce. */
function iconType(url: string): string | undefined {
  const path = url.split(/[?#]/)[0] ?? "";
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return MIME_BY_EXTENSION[extension];
}

/**
 * Íconos de la PWA para el tenant activo.
 *
 * Manda el FAVICON: es el único asset del admin que se carga para ser un ícono
 * cuadrado y chico, es el que ya se ve en la pestaña del browser (`generateMetadata`
 * del layout raíz lo usa igual), y así el atajo en la pantalla de inicio y la pestaña
 * muestran lo mismo. El isotipo (`logos.mobile`) y el logo principal quedan de
 * respaldo para la tienda que no cargó favicon.
 *
 * Los tres se declaran con `sizes: "any"` PORQUE NO SABEMOS SUS DIMENSIONES: son URLs
 * subidas desde el admin. Mentir un `512x512` haría que el browser elija ese ícono
 * para el atajo y lo muestre escalado y borroso; `any` deja que use el que hay al
 * tamaño que tenga.
 *
 * ⚠ Instalabilidad: Chrome pide un ícono cuadrado de al menos 192px. Con `any`
 * alcanza mientras el asset lo sea; una tienda cuyo favicon sea un `.ico` de 32px va a
 * poder instalarse igual pero con un ícono pobre. La solución de producto es un campo
 * de ícono de PWA en el admin, no adivinar acá.
 */
function brandIcons(assets: TenantConfig["assets"]): ManifestIcons {
  const src = [assets.favicon, assets.logos?.mobile, assets.logos?.main]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .find((value) => !BOILERPLATE_ASSETS.has(value));
  if (!src) return BOILERPLATE_ICONS;

  const icon: ManifestIcons[number] = { src, sizes: "any", purpose: "any" };
  const type = iconType(src);
  if (type) icon.type = type;
  return [icon];
}

/**
 * `short_name` es lo que se lee DEBAJO del ícono en la pantalla de inicio, donde
 * entran ~12 caracteres. Se corta por palabra para no dejar la marca partida al
 * medio ("Desde El S…"), y si la primera palabra ya es larga se corta ahí.
 */
function shortName(brand: string): string {
  if (brand.length <= 12) return brand;
  const [firstWord = brand] = brand.split(/\s+/);
  return firstWord.slice(0, 12);
}

export type PwaBrand = {
  /** Nombre de la tienda activa. */
  name: string;
  /** Nombre corto para la pantalla de inicio. */
  shortName: string;
  description: string;
  themeColor: string;
  icons: ManifestIcons;
  /** `''` bajo resolución por host, `/tienda/<slug>` bajo resolución por path. */
  prefix: string;
};

/**
 * Marca de PWA de un tenant. PURA: no lee el request, así se puede testear.
 *
 * `prefix` es `''` bajo resolución por host y `/tienda/<slug>` bajo resolución por
 * path — de ahí sale el `start_url` de la app instalada.
 */
export function buildPwaBrand(tenant: TenantConfig, prefix: string): PwaBrand {
  const name = tenant.name || defaultConfig.name;
  const description =
    tenant.metadata?.seo?.description ||
    tenant.metadata?.description ||
    `Tienda online de ${name}`;

  return {
    name,
    shortName: shortName(name),
    description,
    themeColor: tenant.theme?.colors?.primary || defaultConfig.theme.colors.primary,
    icons: brandIcons(tenant.assets ?? defaultConfig.assets),
    prefix,
  };
}
