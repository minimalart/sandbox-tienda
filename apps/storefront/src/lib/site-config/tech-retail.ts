import type { TechRetailHomeConfig } from "./types";

/**
 * Imágenes demo (Unsplash) con temática de electrónica / electrodomésticos.
 * Son contenido de muestra: reemplazá por tus propios assets de marca.
 */
const unsplash = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const TR_IMG = {
  heroTv: unsplash("photo-1593359677879-a4bb92f829d1", 1600), // tv
  heroNotebook: unsplash("photo-1496181133206-80ce9b88a853", 1600), // notebook
  heroGaming: unsplash("photo-1542751371-adc38448a05e", 1600), // setup gamer
  phones: unsplash("photo-1592750475338-74b7b21085ab"), // celular
  tvs: unsplash("photo-1593359677879-a4bb92f829d1"), // tv
  notebooks: unsplash("photo-1496181133206-80ce9b88a853"), // notebook
  gaming: unsplash("photo-1606144042614-b2417e99c4e3"), // gaming
  audio: unsplash("photo-1505740420928-5e560c06d30e"), // auriculares
  appliances: unsplash("photo-1556911220-bff31c812dba"), // electro
  climate: unsplash("photo-1631545806609-26b5c3a48b8e"), // climatización
  homeOffice: unsplash("photo-1593642532744-d377ab507dc8", 1600), // home office
  setupGamer: unsplash("photo-1542751371-adc38448a05e", 1600), // gaming banner
};

/**
 * Contenido por defecto de la home del template Tecnología Retail.
 *
 * Inspirado en Frávega / Best Buy / Cetrogar: alta densidad, gran catálogo,
 * foco en marcas, financiación/cuotas y promociones. Cards informativas con
 * marca, precio, descuento y cuotas. Reemplazá imágenes, copy y enlaces por los
 * de tu demo/marca; cada demo puede sobreescribir este bloque vía
 * `assets.techRetail`.
 */
export const techRetailConfig: TechRetailHomeConfig = {
  header: {
    searchPlaceholder: "Buscá entre miles de productos, marcas y modelos…",
    categories: [
      { id: "celulares", name: "Celulares", href: "/store?q=celulares" },
      { id: "tvs", name: "TVs", href: "/store?q=tv" },
      { id: "notebooks", name: "Notebooks", href: "/store?q=notebooks" },
      { id: "gaming", name: "Gaming", href: "/store?q=gaming" },
      { id: "audio", name: "Audio", href: "/store?q=audio" },
      {
        id: "electro",
        name: "Electrodomésticos",
        href: "/store?q=electrodomesticos",
      },
      {
        id: "climatizacion",
        name: "Climatización",
        href: "/store?q=climatizacion",
      },
    ],
  },
  hero: {
    rotationInterval: 6000,
    slides: [
      {
        id: "tvs",
        eyebrow: "Smart TVs",
        title: "TVs 4K y QLED al mejor precio",
        subtitle: "Las mejores marcas para renovar tu pantalla.",
        highlight: "Hasta 18 cuotas sin interés",
        image: TR_IMG.heroTv,
        theme: "dark",
        primaryCta: { text: "Ver TVs", href: "/store?q=tv" },
        secondaryCta: { text: "Ver ofertas", href: "/store" },
      },
      {
        id: "notebooks",
        eyebrow: "Notebooks",
        title: "Notebooks para trabajar y estudiar",
        subtitle: "Equipos para cada necesidad, con envío gratis.",
        highlight: "Hasta 12 cuotas sin interés",
        image: TR_IMG.heroNotebook,
        theme: "dark",
        primaryCta: { text: "Ver notebooks", href: "/store?q=notebooks" },
        secondaryCta: { text: "Ver más", href: "/store" },
      },
      {
        id: "gaming",
        eyebrow: "Gaming",
        title: "Armá tu setup gamer",
        subtitle: "Consolas, monitores y periféricos de las top marcas.",
        highlight: "Financiación especial en gaming",
        image: TR_IMG.heroGaming,
        theme: "dark",
        primaryCta: { text: "Ver gaming", href: "/store?q=gaming" },
        secondaryCta: { text: "Ver ofertas", href: "/store" },
      },
    ],
  },
  categories: {
    title: "Categorías destacadas",
    subtitle: "Todo el catálogo, ordenado para encontrarlo rápido.",
    categories: [
      {
        id: "celulares",
        name: "Celulares",
        image: TR_IMG.phones,
        href: "/store?q=celulares",
        backgroundColor: "#f3f5f8",
      },
      {
        id: "tvs",
        name: "TVs",
        image: TR_IMG.tvs,
        href: "/store?q=tv",
        backgroundColor: "#eef1f5",
      },
      {
        id: "notebooks",
        name: "Notebooks",
        image: TR_IMG.notebooks,
        href: "/store?q=notebooks",
        backgroundColor: "#f3f5f8",
      },
      {
        id: "gaming",
        name: "Gaming",
        image: TR_IMG.gaming,
        href: "/store?q=gaming",
        backgroundColor: "#eef1f5",
      },
      {
        id: "audio",
        name: "Audio",
        image: TR_IMG.audio,
        href: "/store?q=audio",
        backgroundColor: "#f3f5f8",
      },
      {
        id: "electro",
        name: "Electrodomésticos",
        image: TR_IMG.appliances,
        href: "/store?q=electrodomesticos",
        backgroundColor: "#f5f1ee",
      },
      {
        id: "climatizacion",
        name: "Climatización",
        image: TR_IMG.climate,
        href: "/store?q=climatizacion",
        backgroundColor: "#eef5f6",
      },
    ],
  },
  brands: {
    title: "Marcas destacadas",
    subtitle: "Las marcas líderes, con garantía oficial.",
    brands: [
      { id: "samsung", name: "Samsung", href: "/store?brand=Samsung" },
      { id: "lg", name: "LG", href: "/store?brand=LG" },
      { id: "motorola", name: "Motorola", href: "/store?brand=Motorola" },
      { id: "sony", name: "Sony", href: "/store?brand=Sony" },
      { id: "philips", name: "Philips", href: "/store?brand=Philips" },
      { id: "lenovo", name: "Lenovo", href: "/store?brand=Lenovo" },
      { id: "xiaomi", name: "Xiaomi", href: "/store?brand=Xiaomi" },
      { id: "noblex", name: "Noblex", href: "/store?brand=Noblex" },
    ],
  },
  financing: {
    title: "Financiación y promociones",
    subtitle: "Más formas de comprar lo que necesitás.",
    plans: [
      {
        id: "18-cuotas",
        icon: "credit-card",
        highlight: "18",
        title: "Cuotas sin interés",
        description: "En productos seleccionados con todas las tarjetas.",
        href: "/store",
        accent: "#e30613",
        backgroundColor: "#fdeeef",
      },
      {
        id: "12-cuotas",
        icon: "credit-card",
        highlight: "12",
        title: "Cuotas sin interés",
        description: "En miles de productos de todas las categorías.",
        href: "/store",
        accent: "#0066cc",
        backgroundColor: "#eef4fb",
      },
      {
        id: "bancarios",
        icon: "bank",
        title: "Descuentos bancarios",
        description: "Beneficios exclusivos según tu banco y día.",
        href: "/store",
        accent: "#0066cc",
        backgroundColor: "#f3f5f8",
      },
      {
        id: "promos",
        icon: "percent",
        title: "Ofertas de la semana",
        description: "Precios especiales por tiempo limitado.",
        href: "/store",
        accent: "#e30613",
        backgroundColor: "#fdeeef",
      },
    ],
  },
  featuredProducts: {
    title: "Productos destacados",
    mobileTitle: "Destacados",
    description: "Lo más buscado del catálogo, con cuotas y envío gratis.",
    filter: {
      limit: 12,
      sortBy: "created_at",
    },
  },
  gaming: {
    eyebrow: "Zona Gaming",
    title: "Llevá tu juego al siguiente nivel",
    subtitle:
      "Consolas, monitores 144Hz, sillas y periféricos con la mejor financiación.",
    image: TR_IMG.setupGamer,
    theme: "dark",
    cta: { text: "Ver Gaming", href: "/store?q=gaming" },
  },
  homeOffice: {
    eyebrow: "Home Office",
    title: "Equipá tu espacio de trabajo",
    subtitle:
      "Notebooks, monitores, impresoras y todo para tu oficina en casa.",
    image: TR_IMG.homeOffice,
    theme: "light",
    cta: { text: "Ver Home Office", href: "/store?q=home+office" },
  },
  benefits: {
    title: "Comprá con confianza",
    items: [
      {
        id: "envio",
        icon: "truck",
        title: "Envío a todo el país",
        description: "Recibí tu compra donde estés.",
      },
      {
        id: "retiro",
        icon: "store",
        title: "Retiro en sucursal",
        description: "Sin costo y cuando quieras.",
      },
      {
        id: "garantia",
        icon: "badge-check",
        title: "Garantía oficial",
        description: "Todos los productos con respaldo.",
      },
      {
        id: "soporte",
        icon: "headset",
        title: "Soporte y atención",
        description: "Te ayudamos antes y después de tu compra.",
      },
    ],
  },
  newsletter: {
    title: "Recibí ofertas y lanzamientos antes que nadie",
    description:
      "Suscribite y enterate primero de las novedades y promociones en tecnología.",
    placeholder: "tucorreo@ejemplo.com",
    buttonText: "Suscribirme",
  },
  footer: {
    description:
      "Tu tienda de tecnología, electrónica y electrodomésticos, con garantía oficial y la mejor financiación.",
    contact: {
      email: {
        label: "Correo electrónico",
        value: "hola@mercatto.tech",
        href: "mailto:hola@mercatto.tech",
      },
    },
    social: [],
    legal: [
      { name: "Política de privacidad", href: "/legal/legals" },
      { name: "Términos y condiciones", href: "/legal/conditions" },
      { name: "Cambios y devoluciones", href: "/legal/exchangesAndReturns" },
    ],
  },
};
