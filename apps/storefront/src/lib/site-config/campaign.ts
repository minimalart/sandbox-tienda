import type { CampaignHomeConfig } from "./types";

/**
 * Contenido por defecto del template "Campaña / landing institucional".
 *
 * Inspirado en la referencia de tiendas oficiales de instituciones educativas
 * gestionadas por un partner (ej: Educabot para escuelas técnicas). Cada demo
 * puede sobreescribir cualquier campo vía `assets.campaign`.
 *
 * Las imágenes/URLs son placeholders — reemplazá por assets propios.
 */
export const campaignConfig: CampaignHomeConfig = {
  announcement: {
    text: "Tienda oficial · comprá como invitado, sin registrarte",
  },
  chrome: {
    subtitle: "TIENDA OFICIAL",
    poweredByLabel: "Powered by EDUCABOT",
    poweredByHref: "https://educabot.com",
  },
  hero: {
    eyebrow: "BENEFICIO EXCLUSIVO PARA LA COMUNIDAD",
    title: "Llevá la tecnología del aula a tu casa",
    subtitle:
      "Kits de robótica, electrónica, programación y más, creados junto a Educabot para que sigas aprendiendo fuera del taller.",
    primaryCta: { text: "Ver los kits", href: "#tienda" },
    image:
      "https://images.unsplash.com/photo-1591696205602-2f950c417cb9?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Kit educativo con componentes electrónicos",
    trustBadges: [
      { id: "cuotas", icon: "credit-card", label: "3 cuotas sin interés" },
      { id: "retiro", icon: "store", label: "Retiro gratis en la escuela" },
    ],
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
    poweredBy: { label: "Plataforma provista por EDUCABOT", href: "https://educabot.com" },
  },
};
