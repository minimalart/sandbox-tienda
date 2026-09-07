import type { TechnologyHomeConfig } from "./types";

/**
 * Imágenes demo (Unsplash) con temática de tecnología / electrónica.
 * Son contenido de muestra: reemplazá por tus propios assets de marca.
 */
const unsplash = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const TECH_IMG = {
  heroPhone: unsplash("photo-1511707171634-5f897ff02aa9", 1600), // smartphone
  laptops: unsplash("photo-1496181133206-80ce9b88a853"), // notebook
  tvs: unsplash("photo-1593359677879-a4bb92f829d1"), // tv
  audio: unsplash("photo-1505740420928-5e560c06d30e"), // auriculares
  phones: unsplash("photo-1592750475338-74b7b21085ab"), // celular
  gaming: unsplash("photo-1606144042614-b2417e99c4e3"), // gaming
  appliances: unsplash("photo-1556911220-bff31c812dba"), // cocina / electro
  smartHome: unsplash("photo-1558002038-1055907df827"), // smart home
  climate: unsplash("photo-1631545806609-26b5c3a48b8e"), // climatización
  homeOffice: unsplash("photo-1593642532744-d377ab507dc8", 1400), // home office
  students: unsplash("photo-1517245386807-bb43f82c33c4", 1400), // estudiantes
  entertainment: unsplash("photo-1593784991095-a205069470b6", 1400), // entretenimiento
  setupGamer: unsplash("photo-1542751371-adc38448a05e", 1600), // setup gamer banner
};

/**
 * Contenido por defecto de la home del template Tecnología.
 *
 * Inspirado en las referencias del brief (Samsung, Apple, Best Buy, B&H,
 * Frávega): hero de producto protagonista, foco en marcas y categorías,
 * financiación destacada y compra por necesidad. Reemplazá imágenes, copy
 * y enlaces por los de tu demo/marca; cada demo puede sobreescribir este
 * bloque vía `assets.technology`.
 */
export const technologyConfig: TechnologyHomeConfig = {
  header: {
    searchPlaceholder: "Buscá productos, marcas y más…",
    categories: [
      { id: "celulares", name: "Celulares", href: "/store?q=celulares" },
      { id: "notebooks", name: "Notebooks", href: "/store?q=notebooks" },
      { id: "tvs", name: "TVs", href: "/store?q=tv" },
      { id: "audio", name: "Audio", href: "/store?q=audio" },
      { id: "gaming", name: "Gaming", href: "/store?q=gaming" },
      {
        id: "electro",
        name: "Electrodomésticos",
        href: "/store?q=electrodomesticos",
      },
      { id: "smart-home", name: "Smart Home", href: "/store?q=smart+home" },
    ],
  },
  hero: {
    eyebrow: "Mercatto Tech",
    title: "Tecnología para renovar tu casa",
    subtitle:
      "Las últimas novedades en celulares, notebooks y electro, con la mejor financiación.",
    highlight: "Hasta 12 cuotas sin interés en productos seleccionados",
    image: TECH_IMG.heroPhone,
    theme: "dark",
    primaryCta: { text: "Ver ofertas", href: "/store" },
    secondaryCta: { text: "Conocer más", href: "/store?q=novedades" },
  },
  featuredCategories: {
    title: "Explorá por categoría",
    subtitle: "Todo lo que buscás, ordenado para encontrarlo rápido.",
    categories: [
      {
        id: "celulares",
        name: "Celulares",
        image: TECH_IMG.phones,
        href: "/store?q=celulares",
        backgroundColor: "#f5f5f7",
      },
      {
        id: "notebooks",
        name: "Notebooks",
        image: TECH_IMG.laptops,
        href: "/store?q=notebooks",
        backgroundColor: "#eef1f5",
      },
      {
        id: "tvs",
        name: "TVs",
        image: TECH_IMG.tvs,
        href: "/store?q=tv",
        backgroundColor: "#f0f0f2",
      },
      {
        id: "audio",
        name: "Audio",
        image: TECH_IMG.audio,
        href: "/store?q=audio",
        backgroundColor: "#f5f5f7",
      },
      {
        id: "gaming",
        name: "Gaming",
        image: TECH_IMG.gaming,
        href: "/store?q=gaming",
        backgroundColor: "#eef1f5",
      },
      {
        id: "climatizacion",
        name: "Climatización",
        image: TECH_IMG.climate,
        href: "/store?q=climatizacion",
        backgroundColor: "#eef5f6",
      },
      {
        id: "cocina",
        name: "Cocina",
        image: TECH_IMG.appliances,
        href: "/store?q=cocina",
        backgroundColor: "#f5f1ee",
      },
      {
        id: "smart-home",
        name: "Smart Home",
        image: TECH_IMG.smartHome,
        href: "/store?q=smart+home",
        backgroundColor: "#f0f0f2",
      },
    ],
  },
  featuredBrands: {
    title: "Marcas destacadas",
    subtitle: "Las marcas líderes, con garantía oficial.",
    brands: [
      { id: "samsung", name: "Samsung", href: "/store?brand=Samsung" },
      { id: "apple", name: "Apple", href: "/store?brand=Apple" },
      { id: "sony", name: "Sony", href: "/store?brand=Sony" },
      { id: "lg", name: "LG", href: "/store?brand=LG" },
      { id: "xiaomi", name: "Xiaomi", href: "/store?brand=Xiaomi" },
      { id: "motorola", name: "Motorola", href: "/store?brand=Motorola" },
      { id: "lenovo", name: "Lenovo", href: "/store?brand=Lenovo" },
      { id: "philips", name: "Philips", href: "/store?brand=Philips" },
    ],
  },
  featuredProducts: {
    title: "Productos destacados",
    mobileTitle: "Destacados",
    description: "Una selección de lo mejor del catálogo, con cuotas y envío.",
    filter: {
      limit: 12,
      sortBy: "created_at",
    },
  },
  promotions: {
    title: "Financiación y promociones",
    subtitle: "Más formas de comprar lo que necesitás.",
    blocks: [
      {
        id: "cuotas",
        icon: "credit-card",
        title: "Hasta 12 cuotas sin interés",
        description: "En productos seleccionados con todas las tarjetas.",
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
        backgroundColor: "#f5f5f7",
      },
      {
        id: "envio",
        icon: "truck",
        title: "Envío gratis",
        description: "En miles de productos seleccionados a todo el país.",
        href: "/store",
        accent: "#0066cc",
        backgroundColor: "#eef6f0",
      },
      {
        id: "ofertas",
        icon: "clock",
        title: "Ofertas por tiempo limitado",
        description: "Aprovechá precios especiales antes de que terminen.",
        href: "/store",
        accent: "#0066cc",
        backgroundColor: "#fbf1ee",
      },
    ],
  },
  useCases: {
    title: "Comprá por necesidad",
    subtitle: "Armá tu setup ideal según lo que estás buscando.",
    items: [
      {
        id: "home-office",
        title: "Home Office",
        subtitle: "Equipá tu espacio de trabajo",
        image: TECH_IMG.homeOffice,
        href: "/store?q=home+office",
        theme: "light",
      },
      {
        id: "gaming",
        title: "Gaming",
        subtitle: "Armá tu setup gamer",
        image: TECH_IMG.gaming,
        href: "/store?q=gaming",
        theme: "dark",
      },
      {
        id: "estudiantes",
        title: "Estudiantes",
        subtitle: "Todo para estudiar mejor",
        image: TECH_IMG.students,
        href: "/store?q=estudiantes",
        theme: "light",
      },
      {
        id: "smart-home",
        title: "Smart Home",
        subtitle: "Conectá y automatizá tu casa",
        image: TECH_IMG.smartHome,
        href: "/store?q=smart+home",
        theme: "dark",
      },
      {
        id: "entretenimiento",
        title: "Entretenimiento",
        subtitle: "Cine y música en casa",
        image: TECH_IMG.entertainment,
        href: "/store?q=entretenimiento",
        theme: "light",
      },
      {
        id: "cocina",
        title: "Cocina equipada",
        subtitle: "Electro para tu cocina",
        image: TECH_IMG.appliances,
        href: "/store?q=cocina",
        theme: "light",
      },
    ],
  },
  secondaryBanner: {
    eyebrow: "Setup gamer",
    title: "Armá tu setup gamer",
    subtitle:
      "Monitores, periféricos y consolas con la mejor financiación. Llevá tu juego al siguiente nivel.",
    image: TECH_IMG.setupGamer,
    theme: "dark",
    cta: { text: "Ver gaming", href: "/store?q=gaming" },
  },
  benefits: {
    title: "Comprá con confianza",
    items: [
      {
        id: "envios",
        icon: "truck",
        title: "Envíos a todo el país",
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
        id: "pago",
        icon: "lock",
        title: "Pago seguro",
        description: "Tus datos siempre protegidos.",
      },
      {
        id: "atencion",
        icon: "headset",
        title: "Atención especializada",
        description: "Te ayudamos a elegir mejor.",
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
    newsletter: {
      title: "Novedades",
      placeholder: "tucorreo@ejemplo.com",
      buttonText: "Suscribirme",
    },
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
