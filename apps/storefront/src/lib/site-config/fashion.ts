import type { FashionHomeConfig } from "./types";

/**
 * Imágenes demo (Unsplash) con temática editorial de moda / indumentaria.
 * Son contenido de muestra: reemplazá por las campañas de tu marca.
 */
const unsplash = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const FASHION_IMG = {
  hero: unsplash("photo-1483985988355-763728e1935b", 2000), // campaña editorial
  heroMobile: unsplash("photo-1483985988355-763728e1935b", 1000),
  women: unsplash("photo-1539109136881-3be0616acf4b"), // mujer
  men: unsplash("photo-1516257984-b1b4d707412e"), // hombre
  footwear: unsplash("photo-1525966222134-fcfa99b8ae77"), // calzado
  accessories: unsplash("photo-1492707892479-7bc8d5a4ee93"), // accesorios
  newCollection: unsplash("photo-1490481651871-ab68de25d43d", 2000), // nueva colección
  campaign: unsplash("photo-1469334031218-e382a71b716b", 1800), // storytelling
  workwear: unsplash("photo-1507003211169-0a1dd7228f2d"), // workwear
  casual: unsplash("photo-1521572163474-6864f9cf17ab"), // casual
  outdoor: unsplash("photo-1551698618-1dfe5d97d256"), // outdoor
  running: unsplash("photo-1538805060514-97d9cc17730c"), // running
  essentials: unsplash("photo-1487412720507-e7ab37603c6f"), // essentials
  look1: unsplash("photo-1485231183945-fffde7cc051e", 1200),
  look2: unsplash("photo-1496747611176-843222e1e57c", 1200),
  look3: unsplash("photo-1529139574466-a303027c1d8b", 1200),
  look4: unsplash("photo-1475180098004-ca77a66827be", 1200),
  look5: unsplash("photo-1517841905240-472988babdf9", 1200),
  season: unsplash("photo-1441986300917-64674bd600d8", 2000), // banner temporada
};

/**
 * Contenido por defecto de la home del template Moda.
 *
 * Inspirado en las referencias del brief (COS, Zara, Aime Leon Dore, Nike):
 * fotografía editorial protagonista, mucho aire, copy sobrio en inglés/español
 * y foco en colección + temporada + lifestyle. Reemplazá imágenes, copy y
 * enlaces por los de tu demo/marca; cada demo puede sobreescribir este bloque
 * vía `assets.fashion`.
 */
export const fashionConfig: FashionHomeConfig = {
  header: {
    searchPlaceholder: "Buscar",
    nav: [
      { id: "women", name: "Mujer", href: "/store?q=mujer" },
      { id: "men", name: "Hombre", href: "/store?q=hombre" },
      { id: "footwear", name: "Calzado", href: "/store?q=calzado" },
      { id: "accessories", name: "Accesorios", href: "/store?q=accesorios" },
      { id: "new", name: "Nueva Colección", href: "/store?q=nueva+coleccion" },
    ],
  },
  hero: {
    eyebrow: "Spring / Summer",
    title: "New Collection",
    subtitle: "Designed for everyday movement.",
    image: FASHION_IMG.hero,
    imageMobile: FASHION_IMG.heroMobile,
    theme: "light",
    align: "left",
    verticalAlign: "bottom",
    cta: { text: "Descubrir", href: "/store" },
  },
  featuredCollections: {
    title: "Colecciones",
    subtitle: "Explorá las líneas de la temporada.",
    collections: [
      {
        id: "women",
        name: "Mujer",
        image: FASHION_IMG.women,
        href: "/store?q=mujer",
        span: "tall",
        theme: "dark",
      },
      {
        id: "men",
        name: "Hombre",
        image: FASHION_IMG.men,
        href: "/store?q=hombre",
        theme: "dark",
      },
      {
        id: "footwear",
        name: "Calzado",
        image: FASHION_IMG.footwear,
        href: "/store?q=calzado",
        theme: "dark",
      },
      {
        id: "accessories",
        name: "Accesorios",
        image: FASHION_IMG.accessories,
        href: "/store?q=accesorios",
        theme: "dark",
      },
      {
        id: "new",
        name: "Nueva Colección",
        label: "Nueva Colección",
        image: FASHION_IMG.newCollection,
        href: "/store?q=nueva+coleccion",
        span: "wide",
        theme: "dark",
      },
    ],
  },
  campaign: {
    eyebrow: "Spring Collection",
    title: "Designed for everyday movement.",
    body: "Una colección pensada para la vida en movimiento. Tejidos naturales, siluetas relajadas y una paleta serena que acompaña cada momento del día.",
    image: FASHION_IMG.campaign,
    theme: "light",
    imageSide: "left",
    cta: { text: "Ver la campaña", href: "/store?q=campaña" },
  },
  newArrivals: {
    title: "New Arrivals",
    description: "Lo último que sumamos a la colección.",
    filter: {
      limit: 12,
      sortBy: "created_at",
    },
  },
  lifestyleCategories: {
    title: "Lifestyle",
    subtitle: "Encontrá tu estilo.",
    items: [
      {
        id: "workwear",
        name: "Workwear",
        image: FASHION_IMG.workwear,
        href: "/store?q=workwear",
      },
      {
        id: "casual",
        name: "Casual",
        image: FASHION_IMG.casual,
        href: "/store?q=casual",
      },
      {
        id: "outdoor",
        name: "Outdoor",
        image: FASHION_IMG.outdoor,
        href: "/store?q=outdoor",
      },
      {
        id: "running",
        name: "Running",
        image: FASHION_IMG.running,
        href: "/store?q=running",
      },
      {
        id: "essentials",
        name: "Essentials",
        image: FASHION_IMG.essentials,
        href: "/store?q=essentials",
      },
    ],
  },
  lookbook: {
    title: "Lookbook",
    subtitle: "Spring / Summer — editorial.",
    items: [
      {
        id: "look-1",
        image: FASHION_IMG.look1,
        label: "Look 01",
        href: "/store?q=look+01",
        span: "tall",
      },
      {
        id: "look-2",
        image: FASHION_IMG.look2,
        label: "Look 02",
        href: "/store?q=look+02",
      },
      {
        id: "look-3",
        image: FASHION_IMG.look3,
        label: "Look 03",
        href: "/store?q=look+03",
      },
      {
        id: "look-4",
        image: FASHION_IMG.look5,
        label: "Look 04",
        href: "/store?q=look+04",
        span: "wide",
      },
    ],
  },
  featuredProducts: {
    title: "Destacados",
    description: "Piezas seleccionadas de la temporada.",
    filter: {
      limit: 12,
      sortBy: "price_desc",
    },
  },
  seasonBanner: {
    eyebrow: "Temporada",
    title: "Summer Essentials",
    subtitle: "Las piezas que definen la estación.",
    image: FASHION_IMG.season,
    theme: "dark",
    align: "center",
    cta: { text: "Ver temporada", href: "/store?q=summer" },
  },
  newsletter: {
    title: "Sumate a la lista",
    description:
      "Recibí nuestras campañas, lanzamientos y editoriales antes que nadie.",
    placeholder: "Tu email",
    buttonText: "Suscribirme",
  },
  footer: {
    description:
      "Moda contemporánea, indumentaria y lifestyle. Diseño atemporal, hecho para durar.",
    newsletter: {
      title: "Newsletter",
      placeholder: "Tu email",
      buttonText: "Suscribirme",
    },
    contact: {
      email: {
        label: "Contacto",
        value: "hola@mercatto.studio",
        href: "mailto:hola@mercatto.studio",
      },
    },
    social: [
      { name: "Instagram", href: "https://instagram.com", icon: "instagram" },
      { name: "TikTok", href: "https://tiktok.com", icon: "tiktok" },
    ],
    legal: [
      { name: "Política de privacidad", href: "/legal/legals" },
      { name: "Términos y condiciones", href: "/legal/conditions" },
      { name: "Cambios y devoluciones", href: "/legal/exchangesAndReturns" },
    ],
  },
};
