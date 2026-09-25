import { technologyConfig } from "./technology";
import { fashionConfig } from "./fashion";
import { techRetailConfig } from "./tech-retail";
import { sportsConfig } from "./sports";
import type { TenantConfig } from "./types";

/**
 * Imágenes demo (Unsplash) con temática de supermercado.
 * Son contenido de muestra: reemplazá por tus propios assets de marca.
 */
const unsplash = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const DEMO_IMG = {
  heroAisle: unsplash("photo-1578916171728-46686eac8d58", 1440), // pasillo de súper
  freshStand: unsplash("photo-1550989460-0adf9ea622e2", 1440), // puesto de frescos
  produce: unsplash("photo-1542838132-92c53300491e"), // frutas y verduras
  grocery: unsplash("photo-1604719312566-8912e9227c6a"), // pasillo de almacén
  drinks: unsplash("photo-1551024709-8f23befc6f87"), // bebidas
  bazar: unsplash("photo-1556909212-d5b604d0c90d"), // cocina / bazar
  offers: unsplash("photo-1543168256-418811576931"), // compra de almacén
  bags: unsplash("photo-1588964895597-cfccd6e2dbf9"), // bolsas de compra
};

/**
 * Default site configuration for the boilerplate.
 * Replace with your brand values when customizing.
 */
export const defaultConfig: TenantConfig = {
  id: "storefront",
  domains: ["localhost"],
  name: "Mercatto",
  // Tienda principal: template supermercado. Las demos de Tecnología usan
  // `template: "technology"` (resuelto desde Demo Stores).
  template: "grocery",
  vertical: "grocery",
  medusa: {
    salesChannelId: process.env.NEXT_PUBLIC_SALES_CHANNEL_ID!,
    customerGroupId: process.env.NEXT_PUBLIC_CUSTOMER_GROUP_ID,
    publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY!,
  },
  theme: {
    colors: {
      // Mercatto — verde como único color de acción primaria
      primary: "#2e7d32",
      secondary: "#374151",
      // El acento pinta las etiquetas de promo y el banner de beneficios: tiene
      // que ser un color de promo, no el gris neutro (se confundía con "Sin
      // Stock", que usa ese mismo tono).
      accent: "#f97316",
    },
  },
  assets: {
    logos: {
      // Match what the header/footer actually render for the main store so
      // switching those components to read the tenant logo is a no-op here,
      // while demo tenants override these with their own branding.
      main: "/logos-mercatto/logocompleto-verde.svg",
      footer: "/logos-mercatto/logocompleto-verde.svg",
      mobile: "/logo_full.webp",
    },
    // Hero banners: contenido demo. Reemplazá con tus assets de marca.
    heroBanners: {
      carousel: [
        {
          id: "hero-1",
          title: "Hacé tu compra del mes",
          subtitle: "Miles de productos al mejor precio, con envío a todo el país.",
          image: DEMO_IMG.heroAisle,
          cardColor: "#EAF0E8",
          cta: { text: "Comprar ahora", href: "/store" },
        },
        {
          id: "hero-2",
          title: "Frescura todos los días",
          subtitle: "Frutas, verduras y lácteos seleccionados cada mañana.",
          image: DEMO_IMG.freshStand,
          cardColor: "#EEECEB",
          cta: { text: "Ver frescos", href: "/store?q=frescos" },
        },
      ],
      sideCards: [
        {
          id: "side-1",
          title: "Ofertas de la semana",
          subtitle: "Precios bajos en almacén y limpieza.",
          mobileTitle: "Ofertas",
          mobileSubtitle: "Precios bajos de la semana",
          gradient: "linear-gradient(135deg, #EAF0E8 0%, #d7e3d3 100%)",
          productImage: DEMO_IMG.offers,
          href: "/store?q=ofertas",
          colorFont: "#1f2937",
        },
        {
          id: "side-2",
          title: "Llevá más, pagá menos",
          subtitle: "Combos y packs para tu alacena.",
          mobileTitle: "Combos",
          mobileSubtitle: "Llevá más, pagá menos",
          gradient: "linear-gradient(135deg, #EEECEB 0%, #ded9d6 100%)",
          productImage: DEMO_IMG.bags,
          href: "/store?q=combos",
          colorFont: "#1f2937",
        },
      ],
    },
    // Featured categories: populated from Medusa categories after seeding
    featuredCategories: {
      title: "Comprá por categoría",
      categories: [],
    },
    // New arrivals: driven by products tagged "new-arrival"
    newArrivals: {
      title: "Novedades",
      subtitle: "Recién llegados",
      products: [],
      viewAllCard: {
        title: "Ver todo",
        href: "/store",
      },
    },
    // Featured products: la fila CURADA. Ordena por el ranking comercial
    // (`metadata.ranking`, el mismo que manda en el buscador y en el PLP), así
    // que lo que el merchant sube en ranking sube acá.
    //
    // NO usa `created_at`: esa es la fila de Novedades, y con el mismo filtro
    // las dos filas del home traían exactamente los mismos 12 productos (sólo
    // cambiaba la tarjeta). Con `ranking` cada una tiene criterio propio.
    //
    // Ojo: en un catálogo sin ningún `metadata.ranking` cargado el orden
    // degrada a "con stock primero, luego lo más nuevo" (ver
    // `lib/typesense/core/sort.ts`), así que hasta que el merchant cure algo
    // esta fila se va a parecer a Novedades. Para separarlas antes de curar,
    // apuntá el filtro a una categoría o a un `tag`.
    featuredProducts: {
      title: "Productos destacados",
      description: "Una selección de la góndola pensada para vos.",
      filter: {
        limit: 12,
        sortBy: "ranking",
      },
    },
    // Grillas demo adicionales. Cada una usa un filtro distinto para mostrar
    // las dos variantes de tarjeta (default / compact) y distintos órdenes.
    novedades: {
      title: "Novedades en góndola",
      mobileTitle: "Novedades",
      description: "Lo último que sumamos al catálogo.",
      filter: {
        limit: 12,
        sortBy: "created_at",
      },
    },
    renovaEnergia: {
      title: "Ofertas de la semana",
      mobileTitle: "Ofertas",
      description: "Los mejores precios, por tiempo limitado.",
      filter: {
        limit: 12,
        sortBy: "price_desc",
      },
    },
    // Fila de precio: ordena de menor a mayor y el título lo dice.
    //
    // Antes se llamaba "Lo más vendido" con este mismo `price_asc`, o sea que
    // prometía ventas y mostraba lo más barato del catálogo (sachets de 10 ml,
    // turrones de 25 g). No hay métrica de ventas para sostener ese título: el
    // índice de Typesense sólo tiene `price`, `created_at`, `stock_available` y
    // `metadata.ranking` (curado a mano). Las unidades vendidas reales viven en
    // el Motor de Recomendaciones (estrategia `popular`), no en el índice; una
    // fila de más vendidos en el home tendría que salir de ahí.
    destacadosDelMes: {
      title: "Precios que cuidan tu bolsillo",
      mobileTitle: "Precios bajos",
      description: "De menor a mayor precio: lo más conveniente de la góndola.",
      filter: {
        limit: 12,
        sortBy: "price_asc",
      },
    },
    // Colecciones: tarjetas que enlazan a búsquedas/categorías del store.
    collections: {
      title: "Comprá por categoría",
      subtitle: "Encontrá lo que buscás más rápido.",
      collections: [
        {
          collectionId: "col-frescos",
          label: "Frutas y Verduras",
          image: DEMO_IMG.produce,
          href: "/store?q=frutas",
          backgroundColor: "#EAF0E8",
        },
        {
          collectionId: "col-almacen",
          label: "Almacén",
          image: DEMO_IMG.grocery,
          href: "/store?q=almacen",
          backgroundColor: "#EBF1F6",
        },
        {
          collectionId: "col-bebidas",
          label: "Bebidas",
          image: DEMO_IMG.drinks,
          href: "/store?q=bebidas",
          backgroundColor: "#f8f1f5",
        },
        {
          collectionId: "col-bazar",
          label: "Bazar",
          image: DEMO_IMG.bazar,
          href: "/store?q=bazar",
          backgroundColor: "#EEECEB",
        },
      ],
      viewAllCard: {
        title: "Ver todo",
        subtitle: "el catálogo",
        href: "/store",
      },
    },
    // Logos de marcas/partners (LogoShowcase). Reusa assets locales del demo.
    //
    // SÓLO MARCAS DE TERCEROS (medios de pago, logística, proveedores). La tienda
    // NO va en su propia lista de partners: este archivo es el baseline de TODO
    // deploy del boilerplate, y el merge de `assets` es shallow por clave, así que
    // un sitio que no define `partners` se queda con esta lista entera. Con el logo
    // de la tienda principal adentro, eso le metía `{"name":"Mercatto"}` en el HTML
    // de cada página a un cliente que no tiene nada que ver (DESDEELSUR-61, BUG-10).
    partners: [
      { name: "Hop", src: "/hop.webp" },
      { name: "Andreani", src: "/andreanilogo.webp" },
      { name: "Mercado Pago", src: "/mercadopagologo.webp" },
    ],
    // Conocé más productos: tarjetas de acceso rápido por categoría.
    moreProducts: {
      title: "Conocé más categorías",
      subtitle: "Recorré todo el supermercado.",
      items: [
        {
          categoryId: "more-frescos",
          image: "/isometric/frutas.png",
          label: "Frutas y Verduras",
          backgroundColor: "#EAF0E8",
          href: "/store?q=frutas",
        },
        {
          categoryId: "more-almacen",
          image: "/isometric/almacen.png",
          label: "Almacén",
          backgroundColor: "#EBF1F6",
          href: "/store?q=almacen",
        },
        {
          categoryId: "more-bebidas",
          image: "/isometric/bebidas.png",
          label: "Bebidas",
          backgroundColor: "#f8f1f5",
          href: "/store?q=bebidas",
        },
        {
          categoryId: "more-bazar",
          image: "/isometric/bazar.png",
          label: "Bazar",
          backgroundColor: "#EEECEB",
          href: "/store?q=bazar",
        },
        {
          categoryId: "more-limpieza",
          image: "/isometric/limpieza.png",
          label: "Limpieza",
          backgroundColor: "#E8F5F4",
          href: "/store?q=limpieza",
        },
        {
          categoryId: "more-snacks",
          image: "/isometric/snacks.png",
          label: "Snacks",
          backgroundColor: "#FFF4DF",
          href: "/store?q=snacks",
        },
      ],
      viewAllCard: {
        title: "Ver todo",
        href: "/store",
      },
    },
    // Combos y cajas (EntrepreneurBanner). Requiere video + poster.
    // El demo usa un mp4 público de muestra; reemplazá por tus clips.
    resellerKits: {
      titleHome: "Combos y cajas",
      descriptionHome: "Packs pensados para abastecer tu casa o tu negocio.",
      kits: [
        {
          productId: "combo-semanal",
          title: "Combo Semanal",
          subtitle: "La compra básica de la semana, en una caja.",
          image: "/images/combo-semanal-pack.png",
          bgColor: "#EAF0E8",
          video:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          poster: DEMO_IMG.grocery,
          href: "/store",
        },
        {
          productId: "caja-almacen",
          title: "Caja Almacén",
          subtitle: "Más productos, mejor precio por unidad.",
          image: "/images/caja-almacen-pack.png",
          bgColor: "#EEECEB",
          popular: true,
          video:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
          poster: DEMO_IMG.produce,
          href: "/store",
        },
      ],
    },
    // Sección Vimeo + tarjeta de producto (ShoppableVideos).
    // Fallback demo: si el backend de Medusa no expone videos, se usan estos
    // clips de Vimeo emparejados con productos reales del catálogo.
    shoppableVideos: {
      title: "Videos para tentarse",
      mobileTitle: "Nuestros videos",
      description:
        "Mirá ideas para tu compra y sumá los productos al carrito con un solo clic.",
      videos: [
        { vimeoId: "76979871", poster: DEMO_IMG.produce },
        { vimeoId: "22439234", poster: DEMO_IMG.grocery },
        { vimeoId: "824804225", poster: DEMO_IMG.drinks },
        { vimeoId: "174002812", poster: DEMO_IMG.bazar },
      ],
    },
    topbar: {
      messages: [
        { id: "shipping", text: "Envíos a todo el país", icon: "truck" },
        { id: "payment", text: "Pagos seguros", icon: "credit-card" },
        { id: "online", text: "Comprá online", icon: "shield" },
      ],
      rotationInterval: 6000,
      enabled: true,
    },
    footer: {
      description: "Tu tienda online para todo lo que necesitás, al mejor precio.",
      newsletter: {
        title: "Newsletter",
        placeholder: "ejemplo@correo.com",
        buttonText: "Suscribirme",
      },
      // VACÍO A PROPÓSITO — ningún dato de contacto inventado acá.
      //
      // `mergeMainTenant` mergea `assets.footer` POR SUBCLAVE, así que un sitio que
      // edita sólo `footer.description` desde el backoffice hereda este `contact` tal
      // cual y publica como suyo el dato que esté escrito acá. Es el mismo incidente
      // del teléfono '+54 11 1234-5678' que ya se sacó del componente (ver el comentario
      // en `templates/footer/index.tsx`): un contacto falso en producción es peor que
      // ninguno. El footer renderiza cada campo condicionalmente (`contact.email &&`),
      // así que vacío simplemente no muestra la fila.
      contact: {},
      social: [],
      legal: [
        { name: "Política de privacidad", href: "/legal/legals" },
        { name: "Términos y condiciones", href: "/legal/conditions" },
        { name: "Cambios y devoluciones", href: "/legal/exchangesAndReturns" },
      ],
    },
    favicon: "/favicon.ico",
    // Minicart: default `true` para que tiendas derivadas conserven el
    // comportamiento actual hasta que decidan optar por apagarlo desde el admin.
    cart: {
      recommendationsCarousel: true,
    },
    // Contenido del template Tecnología (solo se usa si template === "technology").
    technology: technologyConfig,
    // Contenido del template Moda (solo se usa si template === "fashion").
    fashion: fashionConfig,
    // Contenido del template Tecnología Retail (solo si template === "tech-retail").
    techRetail: techRetailConfig,
    // Contenido del template Marca Deportiva (solo si template === "sports").
    sports: sportsConfig,
  },
  metadata: {
    name: "Mercatto",
    description: "Tienda online de Mercatto",
  },
};
