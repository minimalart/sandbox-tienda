import type { CampaignHomeConfig } from "./types";

export const DEFAULT_CAMPAIGN_ILLUSTRATION =
  "/images/campaign-default-illustration.png";

export const resolveCampaignHeroImage = (image?: string): string =>
  image?.trim() || DEFAULT_CAMPAIGN_ILLUSTRATION;

/**
 * Contenido por defecto del template "Campaña / landing institucional".
 *
 * Inspirado en la referencia de tiendas oficiales de instituciones educativas
 * gestionadas por un partner (ej: Educabot para escuelas técnicas). Cada demo
 * puede sobreescribir cualquier campo vía `assets.campaign`.
 *
 * Las imágenes propias son opcionales: el componente usa la ilustración
 * genérica del template cuando `hero.image` está ausente o vacío.
 */
export const campaignConfig: CampaignHomeConfig = {
  announcement: {
    text: "Tienda oficial · comprá como invitado, sin registrarte",
  },
  chrome: {
    // Texto del header (subtitulo institucional + pill "Powered by"): NO tienen
    // default. Antes eran "TIENDA OFICIAL" / "Powered by EDUCABOT" / educabot.com
    // → sites que no seteaban `assets.campaign.chrome` heredaban esos valores
    // via overlayCampaign y aparecian en la landing como si el operador los
    // hubiera cargado. Los placeholders del admin form (Sites → Contenido)
    // sugieren el shape esperado; el hide-if-empty solo funciona si el preset
    // no impone contenido.
    subtitle: undefined,
    poweredByLabel: undefined,
    poweredByHref: undefined,
    // Default blanco alineado con el resto del chrome (footer, hero). Sites
    // que no lo pisen desde admin heredan blanco automaticamente.
    backgroundColor: "#ffffff",
  },
  hero: {
    title: "Llevá la tecnología del aula a tu casa",
    subtitle:
      "Kits de robótica, electrónica, programación y más, creados junto a Educabot para que sigas aprendiendo fuera del taller.",
    primaryCta: { text: "Ver los kits", href: "#tienda" },
    // Eyebrow, imagen propia y trust badges quedan apagados por defecto. El
    // componente aporta la ilustración genérica y cada site puede configurarlos.
    // El fondo blanco sigue siendo el default, pero puede pisarse por campaña.
    backgroundColor: "#ffffff",
  },
  kits: {
    title: "Nuestros kits",
    subtitle:
      "Los kits disponibles este ciclo lectivo, pensados para acompañar lo que se aprende en el taller. Stock limitado.",
    filter: { limit: 8 },
    ctaLabel: "Agregar",
  },
  footer: {
    description:
      "Tienda de kits educativos gestionada junto a Educabot. Cada compra ayuda a sostener el equipamiento del taller.",
    address: "Av. Siempre Viva 1234, Buenos Aires",
    email: "tienda@ejemplo.edu.ar",
    copyright: "© 2026 Institución",
    // poweredBy: NO tiene default. Antes era "Plataforma provista por EDUCABOT"
    // / educabot.com y aparecia via overlay en cualquier site sin config
    // explicita. Mismo criterio que chrome.poweredBy* — se muestra si el
    // operador lo carga, y solo se oculta si vacio.
    poweredBy: undefined,
    // Footer blanco por default (mismo criterio que el hero).
    backgroundColor: "#ffffff",
  },
};
