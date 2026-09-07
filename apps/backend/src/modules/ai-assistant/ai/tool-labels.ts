/**
 * Etiquetas y descripciones en español para las tools del MCP. El paquete
 * `mcp-medusa` las trae en inglés y genéricas; acá las localizamos para la UI de
 * Configuración y para el prompt que ve el modelo. El NOMBRE de la tool no se
 * toca (es el id del function-calling); solo `label` (título lindo) y
 * `description`.
 */
export const TOOL_LABELS: Record<string, { label: string; description: string }> = {
  manage_medusa_admin_orders: {
    label: 'Órdenes',
    description:
      'Órdenes: listar, ver detalle, cancelar, completar, archivar, transferir y gestionar envíos (fulfillments).',
  },
  manage_medusa_admin_draft_orders: {
    label: 'Órdenes borrador',
    description:
      'Órdenes borrador (draft): crear, listar, ver, eliminar, convertir en orden y editar líneas.',
  },
  manage_medusa_admin_products: {
    label: 'Productos',
    description:
      'Catálogo: productos, variantes, categorías, tags y tipos (listar, ver, crear, editar, eliminar).',
  },
  manage_medusa_admin_customers: {
    label: 'Clientes',
    description:
      'Clientes, direcciones y grupos de clientes (listar, ver, crear, editar, eliminar, asignar a grupos).',
  },
  manage_medusa_admin_collections: {
    label: 'Colecciones',
    description:
      'Colecciones de productos: listar, ver, crear, editar, eliminar y asociar/quitar productos.',
  },
  manage_medusa_admin_inventory: {
    label: 'Inventario',
    description:
      'Inventario y stock: ítems, ubicaciones (stock locations), niveles de stock y reservas.',
  },
  manage_medusa_admin_regions: {
    label: 'Regiones',
    description: 'Regiones de venta y su configuración (monedas, países, proveedores de pago/envío).',
  },
  manage_medusa_admin_pricing: {
    label: 'Precios y promociones',
    description:
      'Listas de precios, promociones y campañas (listar, ver, crear, editar, eliminar).',
  },
  manage_medusa_admin_payments: {
    label: 'Pagos',
    description:
      'Pagos: colecciones de pago, capturas, cancelaciones, reembolsos y consulta de pagos/reembolsos.',
  },
  manage_medusa_admin_returns: {
    label: 'Devoluciones y cambios',
    description: 'Devoluciones, cambios (exchanges), reclamos (claims) y ediciones de orden.',
  },
  manage_medusa_admin_gift_cards: {
    label: 'Gift cards',
    description: 'Tarjetas de regalo (gift cards): listar, ver, crear, editar, eliminar.',
  },
  manage_medusa_admin_taxes: {
    label: 'Impuestos',
    description: 'Tasas y regiones de impuestos (listar, ver, crear, editar, eliminar).',
  },
  manage_medusa_admin_sales_channels: {
    label: 'Canales de venta',
    description: 'Canales de venta (sales channels) y sus productos asociados.',
  },
  manage_medusa_admin_users: {
    label: 'Usuarios y API keys',
    description:
      'Usuarios admin, invitaciones y API keys del panel (listar, ver, crear, editar, eliminar).',
  },
  manage_medusa_admin_v2: {
    label: 'API genérica (avanzado)',
    description:
      'Acceso genérico a la Admin API de Medusa para recursos no cubiertos por otras herramientas. La acción "request" está deshabilitada por seguridad.',
  },
  analyze_sales: {
    label: 'Análisis de ventas',
    description:
      'Resumen ejecutivo de ventas del período con comparación vs período anterior (KPIs, tendencia, top productos, desgloses).',
  },
  analyze_products: {
    label: 'Análisis de catálogo',
    description:
      'Señales de catálogo: top sellers, productos sin rotación, stock bajo y quiebres (con IDs de inventario reales).',
  },
  analyze_customers: {
    label: 'Análisis de clientes',
    description:
      'Señales de clientes: nuevos vs recurrentes, tasa de recompra, top clientes, clientes en riesgo y grupos existentes.',
  },
  analyze_promotions: {
    label: 'Análisis de promociones',
    description:
      'Performance real de las promociones del período (órdenes alcanzadas y descuento otorgado); detecta promos sin uso.',
  },
  analyze_carts: {
    label: 'Análisis de carritos abandonados',
    description: 'Cantidad y valor recuperable de carritos abandonados, y los abiertos de mayor valor.',
  },
  analyze_search_gaps: {
    label: 'Búsquedas sin resultados',
    description: 'Términos buscados en la tienda que no devuelven resultados (demanda insatisfecha).',
  },
  analyze_loyalty: {
    label: 'Análisis de fidelización',
    description: 'Programa de fidelización activo, campañas de puntos vigentes, rewards y earn rules.',
  },
  create_loyalty_campaign: {
    label: 'Crear campaña de puntos',
    description: 'Crea una campaña de puntos (multiplicador con vigencia) en el programa de fidelización activo.',
  },
  create_loyalty_reward: {
    label: 'Crear reward de fidelización',
    description: 'Crea un reward canjeable por puntos (descuento, envío gratis o crédito en tienda).',
  },
  issue_gift_card: {
    label: 'Emitir gift card a cliente',
    description: 'Emite una gift card y la asigna a un cliente específico (win-back / compensación).',
  },
  create_dynamic_group: {
    label: 'Crear grupo dinámico',
    description: 'Crea un grupo dinámico de clientes (segmento automático) y lo puebla en el momento.',
  },
  create_banner_draft: {
    label: 'Crear banner (borrador)',
    description:
      'Crea un banner en borrador con su imagen generada por IA. Nunca publica: una persona lo revisa y publica.',
  },
  create_landing_draft: {
    label: 'Crear landing (borrador)',
    description:
      'Crea una landing en borrador con su contenido compuesto por IA. Nunca publica: una persona la revisa y publica.',
  },
  manage_minimalart_extensions: {
    label: 'Extensiones del backoffice',
    description:
      'Datos de las extensiones propias: métricas de ventas (commerce_dashboard), marcas, banners, blog, sucursales, landings, biblioteca de medios, empresas, corporativos, grupos dinámicos, plantillas de email, links de venta, videos y contactos.',
  },
};

/**
 * Etiquetas en español para los `resource` de `manage_minimalart_extensions`.
 * Esta tool agrupa varias extensiones del backoffice bajo un mismo set de
 * acciones genéricas; el gating es por (tool, acción, resource).
 */
export const RESOURCE_LABELS: Record<string, string> = {
  commerce_dashboard: 'Métricas de ventas',
  banners: 'Banners',
  blog_categories: 'Blog · Categorías',
  blog_posts: 'Blog · Posts',
  blog_settings: 'Blog · Ajustes',
  brands: 'Marcas',
  checkout_links: 'Links de venta',
  companies: 'Empresas',
  contact_submissions: 'Contactos',
  corporates: 'Corporativos',
  dynamic_groups: 'Grupos dinámicos',
  email_templates: 'Plantillas de email',
  landing_pages: 'Landings',
  media_library: 'Biblioteca de medios',
  sales_channels_b2c: 'Canales B2C',
  store_locations: 'Sucursales',
  videos: 'Videos',
};

/** Descripción localizada (cae al texto original del paquete si no hay override). */
export function toolDescription(name: string, fallback?: string): string {
  return TOOL_LABELS[name]?.description ?? fallback ?? '';
}

/** Título lindo en español (cae al nombre técnico si no hay override). */
export function toolLabel(name: string): string {
  return TOOL_LABELS[name]?.label ?? name;
}

/** Etiqueta en español de un resource (cae al nombre técnico si no hay override). */
export function resourceLabel(resource: string): string {
  return RESOURCE_LABELS[resource] ?? resource;
}
