/**
 * Capacidades multitienda por extensión, para el badge del backoffice.
 *
 * ESPEJO de `packages/project-catalog/src/catalog.json` (campo `multistore`), que es
 * la fuente de verdad. Se repite acá porque el bundle del admin no puede importar
 * fuera de `src/admin/`, y `extension-multistore.test.ts` cruza los dos: si agregás
 * la capacidad en el catálogo y te olvidás de este archivo, el test falla.
 *
 * Son capacidades INDEPENDIENTES, no niveles acumulativos: una extensión sin datos
 * propios puede tener `config` sin tener `data`.
 *
 * Ausencia de entrada = la extensión NO scopea nada: su configuración y sus datos son
 * los mismos para todas las tiendas. No la marques "a ojo": el valor tiene que ser
 * defendible con código, porque un tag optimista hace que alguien asuma un
 * aislamiento que no existe. Ver `EXTENSIONES-MULTITIENDA.md`.
 */
export const MULTISTORE_CAPABILITIES = ['data', 'config', 'credentials'] as const;

export type MultistoreCapability = (typeof MULTISTORE_CAPABILITIES)[number];

/**
 * Qué significa cada capacidad, en lenguaje de quien opera el backoffice.
 * `absent` es la mitad que importa: es lo que le pasa al operador si asume que está
 * configurando su tienda y en realidad está tocando la instancia entera.
 */
export const MULTISTORE_CAPABILITY_COPY: Record<
  MultistoreCapability,
  { label: string; present: string; absent: string }
> = {
  data: {
    label: 'Contenido',
    present: 'cada tienda ve el suyo',
    absent: 'el mismo para todas las tiendas',
  },
  config: {
    label: 'Configuración',
    present: 'se resuelve por tienda',
    absent: 'una sola para toda la instancia',
  },
  credentials: {
    label: 'Credenciales',
    present: 'cada tienda usa las suyas',
    absent: 'las mismas para todas las tiendas',
  },
};

export const EXTENSION_MULTISTORE: Record<string, readonly MultistoreCapability[]> = {
  banners: ['data'],
  blog: ['data'],
  brands: ['data'],
  contact: ['data'],
  'checkout-links': ['data'],
  comments: ['data'],
  corporate: ['data'],
  delivery: ['data'],
  'dynamic-groups': ['data'],
  'email-templates': ['config'],
  'gift-cards': ['data', 'config'],
  'landing-pages': ['data'],
  loyalty: ['data'],
  mercadopago: ['credentials'],
  multistore: ['data', 'config'],
  // Las tres, y la de credenciales es la que importa: `BREVO_API_KEY` es
  // `type: 'secret'` con `scope: 'site'`, así que dos tiendas del mismo backend
  // sincronizan contra dos cuentas de Brevo distintas y una tienda sin configurar
  // queda apagada en vez de heredar la del vecino.
  newsletter: ['data', 'config', 'credentials'],
  'payment-benefits': ['data'],
  'pdf-catalog': ['data'],
  'recommendation-engine': ['data'],
  'recurring-orders': ['data', 'config'],
  'seo-geo': ['data'],
  'shop-by-looks': ['data'],
  'space-designer': ['data', 'config'],
  'store-config': ['config'],
  'store-locations': ['data'],
  videos: ['data'],
  whatsapp: ['credentials'],
};

export type MultistoreScope = {
  /** Estado agregado, para elegir el texto y el color del badge. */
  level: 'none' | 'partial' | 'full';
  /** Las tres capacidades, en orden estable, con si la extensión ya la tiene. */
  capabilities: Array<{ capability: MultistoreCapability; present: boolean }>;
};

/**
 * Alcance multitienda de una extensión. Devuelve SIEMPRE las tres capacidades —
 * también las que faltan— porque el badge tiene que poder contar qué NO está
 * aislado, que es la parte accionable.
 */
export const multistoreScopeOf = (extension: string): MultistoreScope => {
  const declared = EXTENSION_MULTISTORE[extension] ?? [];
  const capabilities = MULTISTORE_CAPABILITIES.map((capability) => ({
    capability,
    present: declared.includes(capability),
  }));
  const present = capabilities.filter((entry) => entry.present).length;
  const level: MultistoreScope['level'] =
    present === 0 ? 'none' : present === MULTISTORE_CAPABILITIES.length ? 'full' : 'partial';
  return { level, capabilities };
};
