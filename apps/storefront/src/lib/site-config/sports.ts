import type { SportsHomeConfig } from "./types";

/**
 * Imágenes demo (Unsplash) con temática deportiva.
 * Son contenido de muestra: reemplazá por tus propios assets de marca.
 */
const unsplash = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const SP_IMG = {
  hero: unsplash("photo-1517836357463-d25dfeac3438", 1800), // running campaign
  heroMobile: unsplash("photo-1538805060514-97d9cc17730c", 900), // running vertical
  running: unsplash("photo-1571008887538-b36bb32f4571"), // running
  football: unsplash("photo-1551958219-acbc608c6377"), // football
  training: unsplash("photo-1534438327276-14e5300c3a48"), // training gym
  basketball: unsplash("photo-1546519638-68e109498ffc"), // basketball
  tennis: unsplash("photo-1622279457486-62dcc4a431d6"), // tennis
  outdoor: unsplash("photo-1551632811-561732d1e306"), // outdoor trail
  collectionRunning: unsplash("photo-1486218119243-13883505764c", 1400),
  collectionTrain: unsplash("photo-1517963879433-6ad2b056d712", 1400),
  collectionMatch: unsplash("photo-1431324155629-1a6deb1dec8d", 1400),
  footwear: unsplash("photo-1542291026-7eec264c27ff"), // sneakers
  apparel: unsplash("photo-1556906781-9a412961c28c"), // apparel
  accessories: unsplash("photo-1593079831268-3381b0db4a77"), // accessories
  campaign: unsplash("photo-1461896836934-ffe607ba8211", 1600), // campaign
  athlete1: unsplash("photo-1552674605-db6ffd4facb5", 1200),
  athlete2: unsplash("photo-1571019613454-1cb2f99b2d8b", 1200),
  lookbook1: unsplash("photo-1483721310020-03333e577078"),
  lookbook2: unsplash("photo-1556817411-31ae72fa3ea0"),
  lookbook3: unsplash("photo-1517649763962-0c623066013b"),
  lookbook4: unsplash("photo-1530549387789-4c1017266635"),
};

/**
 * Contenido por defecto de la home del template Marca Deportiva.
 *
 * Inspirado en Adidas / Puma / Nike: performance, movimiento y deporte. Bold,
 * alto contraste, organizado por deporte. Cards minimalistas (menos info que
 * Tecnología). Reemplazá imágenes, copy y enlaces por los de tu demo/marca;
 * cada demo puede sobreescribir este bloque vía `assets.sports`.
 */
/**
 * Construye un megamenú preseteado (estilo Adidas/Nike) para un género dado.
 * Los enlaces apuntan a búsquedas del catálogo (`/store?q=…`) combinando el
 * término con el género, ya que la tienda demo no expone product-categories.
 */
const buildMegaMenu = (genderQuery: string) => {
  const q = (term: string) =>
    `/store?q=${encodeURIComponent(`${term} ${genderQuery}`.trim())}`;
  return {
    columns: [
      {
        title: "Calzado",
        links: [
          { name: "Zapatillas", href: q("zapatillas") },
          { name: "Running", href: q("zapatillas running") },
          { name: "Botines", href: q("botines") },
          { name: "Ojotas", href: q("ojotas") },
        ],
      },
      {
        title: "Ropa",
        links: [
          { name: "Buzos", href: q("buzo") },
          { name: "Remeras", href: q("remera") },
          { name: "Camperas", href: q("campera") },
          { name: "Pantalones", href: q("pantalon") },
          { name: "Shorts", href: q("short") },
        ],
      },
      {
        title: "Accesorios",
        links: [
          { name: "Mochilas", href: q("mochila") },
          { name: "Gorras", href: q("gorra") },
          { name: "Medias", href: q("medias") },
          { name: "Pelotas", href: q("pelota") },
        ],
      },
      {
        title: "Deportes",
        links: [
          { name: "Running", href: q("running") },
          { name: "Training", href: q("training") },
          { name: "Fútbol", href: q("futbol") },
          { name: "Tenis", href: q("tenis") },
          { name: "Básquet", href: q("basket") },
        ],
      },
    ],
    featured: {
      image: SP_IMG.campaign,
      title: "Nueva temporada",
      subtitle: "Lo último en performance.",
      href: "/store",
    },
  };
};

export const sportsConfig: SportsHomeConfig = {
  header: {
    searchPlaceholder: "Buscar",
    nav: [
      {
        id: "hombre",
        name: "Hombre",
        href: "/store?q=hombre",
        megamenu: buildMegaMenu("hombre"),
      },
      {
        id: "mujer",
        name: "Mujer",
        href: "/store?q=mujer",
        megamenu: buildMegaMenu("mujer"),
      },
      {
        id: "ninos",
        name: "Niños",
        href: "/store?q=ninos",
        megamenu: buildMegaMenu("niño"),
      },
      { id: "deportes", name: "Deportes", href: "/store?q=deportes" },
      { id: "ofertas", name: "Ofertas", href: "/store" },
    ],
  },
  hero: {
    eyebrow: "Nueva temporada",
    title: "A moverse",
    subtitle: "Performance que no se detiene. Entrená como nunca.",
    image: SP_IMG.hero,
    imageMobile: SP_IMG.heroMobile,
    theme: "dark",
    align: "left",
    verticalAlign: "bottom",
    cta: { text: "Ver colección", href: "/store" },
  },
  // Carrusel del hero (animado, autoplay). El primer slide replica `hero`.
  heroSlides: [
    {
      eyebrow: "Nueva temporada",
      title: "A moverse",
      subtitle: "Performance que no se detiene. Entrená como nunca.",
      image: SP_IMG.hero,
      imageMobile: SP_IMG.heroMobile,
      theme: "dark",
      align: "left",
      verticalAlign: "bottom",
      cta: { text: "Ver colección", href: "/store" },
    },
    {
      eyebrow: "Running",
      title: "Sumá kilómetros",
      subtitle: "Lo último en amortiguación para tu mejor marca.",
      image: SP_IMG.collectionRunning,
      imageMobile: SP_IMG.athlete1,
      theme: "dark",
      align: "left",
      verticalAlign: "bottom",
      cta: { text: "Ver running", href: "/store?q=running" },
    },
    {
      eyebrow: "Training",
      title: "Sin excusas",
      subtitle: "Equipate para entrenar sin límites, todos los días.",
      image: SP_IMG.collectionTrain,
      imageMobile: SP_IMG.athlete2,
      theme: "dark",
      align: "left",
      verticalAlign: "bottom",
      cta: { text: "Ver training", href: "/store?q=training" },
    },
  ],
  sports: {
    title: "Elegí tu deporte",
    subtitle: "Equipate para rendir en lo que más te gusta.",
    sports: [
      { id: "running", name: "Running", image: SP_IMG.running, href: "/store?q=running" },
      { id: "football", name: "Football", image: SP_IMG.football, href: "/store?q=football" },
      { id: "training", name: "Training", image: SP_IMG.training, href: "/store?q=training" },
      { id: "basketball", name: "Basketball", image: SP_IMG.basketball, href: "/store?q=basketball" },
      { id: "tennis", name: "Tennis", image: SP_IMG.tennis, href: "/store?q=tennis" },
      { id: "outdoor", name: "Outdoor", image: SP_IMG.outdoor, href: "/store?q=outdoor" },
    ],
  },
  collections: {
    title: "Colecciones",
    subtitle: "Diseñadas para cada momento de tu entrenamiento.",
    collections: [
      {
        id: "running-essentials",
        name: "Running Essentials",
        subtitle: "Lo esencial para sumar kilómetros",
        image: SP_IMG.collectionRunning,
        href: "/store?q=running",
        theme: "dark",
      },
      {
        id: "train-hard",
        name: "Train Hard",
        subtitle: "Para entrenar sin límites",
        image: SP_IMG.collectionTrain,
        href: "/store?q=training",
        theme: "dark",
      },
      {
        id: "match-day",
        name: "Match Day",
        subtitle: "Listo para el partido",
        image: SP_IMG.collectionMatch,
        href: "/store?q=football",
        theme: "dark",
      },
    ],
  },
  categories: {
    title: "Comprá por categoría",
    items: [
      { id: "calzado", name: "Calzado", image: SP_IMG.footwear, href: "/store?q=calzado" },
      { id: "indumentaria", name: "Indumentaria", image: SP_IMG.apparel, href: "/store?q=indumentaria" },
      { id: "accesorios", name: "Accesorios", image: SP_IMG.accessories, href: "/store?q=accesorios" },
    ],
  },
  campaign: {
    eyebrow: "Impossible is nothing",
    title: "Superá tus límites",
    body: "Cada entrenamiento es una oportunidad para ser mejor. Equipate con lo último en performance y dejá todo en cada movimiento.",
    image: SP_IMG.campaign,
    theme: "dark",
    imageSide: "left",
    cta: { text: "Descubrir más", href: "/store" },
  },
  featuredProducts: {
    title: "Lo más nuevo",
    mobileTitle: "Novedades",
    description: "Las últimas novedades para tu próximo entrenamiento.",
    filter: {
      limit: 12,
      sortBy: "created_at",
    },
  },
  athletes: {
    title: "Atletas",
    subtitle: "Los que llevan la marca al límite.",
    athletes: [
      {
        id: "atleta-1",
        name: "Lucía Fernández",
        sport: "Running",
        quote: "Cada kilómetro cuenta.",
        image: SP_IMG.athlete1,
        href: "/store?q=running",
      },
      {
        id: "atleta-2",
        name: "Martín Gómez",
        sport: "Training",
        quote: "Sin excusas, solo trabajo.",
        image: SP_IMG.athlete2,
        href: "/store?q=training",
      },
    ],
  },
  lookbook: {
    title: "En movimiento",
    subtitle: "El deporte en acción.",
    items: [
      { id: "lb1", image: SP_IMG.lookbook1, label: "Running", href: "/store?q=running", span: "tall" },
      { id: "lb2", image: SP_IMG.lookbook2, label: "Training", href: "/store?q=training" },
      { id: "lb3", image: SP_IMG.lookbook3, label: "Outdoor", href: "/store?q=outdoor", span: "wide" },
      { id: "lb4", image: SP_IMG.lookbook4, label: "Basketball", href: "/store?q=basketball" },
    ],
  },
  newsletter: {
    title: "Sumate al equipo",
    description:
      "Recibí lanzamientos, ediciones limitadas y novedades antes que nadie.",
    placeholder: "tucorreo@ejemplo.com",
    buttonText: "Suscribirme",
  },
  footer: {
    description:
      "Performance, movimiento y deporte. Equipate con lo último para dar todo en cada entrenamiento.",
    contact: {
      email: {
        label: "Correo electrónico",
        value: "hola@mercatto.sport",
        href: "mailto:hola@mercatto.sport",
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
