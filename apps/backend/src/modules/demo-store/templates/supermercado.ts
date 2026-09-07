import type { DemoStoreLike, DemoTemplate } from './types';
import { buildBaseAssets } from './shared';

/**
 * Supermercado — the Fase 1 template. Produces a generic, catalog-agnostic
 * storefront layout (topbar + newest-products grids + footer) that works with
 * whatever catalog was imported, since the demo's products/categories are
 * dynamic. Branding (logos/favicon) comes from the demo's theme.
 */
export const supermercadoTemplate: DemoTemplate = {
  code: 'supermercado',
  name: 'Supermercado',
  tenant_template: 'grocery',
  vertical: 'grocery',
  preview_image:
    'https://mercatto.nyc3.digitaloceanspaces.com/supermercado-01KVTGA15MXXXK6B969ZHBTSMY.png',
  buildAssets: (demo: DemoStoreLike) => {
    return {
      ...buildBaseAssets(demo),
      // Template-default hero (demos must NOT inherit the store's admin-managed
      // banners). The storefront falls back to this carousel because demo pages
      // get an empty banners context.
      heroBanners: {
        carousel: [
          {
            id: 'demo-hero-1',
            title: 'Nuestras verduras',
            subtitle: 'Descubrí lo nuevo',
            image:
              'https://mercatto.nyc3.digitaloceanspaces.com/new_banner2-01KV644F10E5545WDD535ST6SE.webp',
            cta: { text: 'Ver colección', href: '/store' },
          },
          {
            id: 'demo-hero-2',
            title: 'Promo TV',
            subtitle: 'Viví el mundial en HD',
            image:
              'https://mercatto.nyc3.digitaloceanspaces.com/new_banner4-01KV644YRS1D8Y9VXXVJE2MQX9.webp',
            cta: { text: 'Lo quiero!', href: '/store?q=tv' },
          },
        ],
      },
      topbar: {
        enabled: true,
        rotationInterval: 6000,
        messages: [
          { id: 'envio', text: 'Envíos a todo el país', icon: 'truck' },
          { id: 'pago', text: 'Pagá en cuotas sin interés', icon: 'credit-card' },
          { id: 'retiro', text: 'Retiro en tienda gratis', icon: 'building-storefront' },
        ],
      },
      // Newest products from the demo's sales channel. The storefront's
      // FeaturedProductsGrid reads these filters and renders the catalog.
      featuredProducts: {
        title: 'Destacados',
        filter: { limit: 12, sortBy: 'created_at' },
      },
      novedades: {
        title: 'Novedades',
        filter: { limit: 12, sortBy: 'created_at' },
      },
      footer: {
        // NO decir "demo": estas tiendas son sitios de clientes reales y esto se
        // renderiza en su footer público.
        description: `${demo.name} — tienda online.`,
        newsletter: {
          title: 'Suscribite a las novedades',
          placeholder: 'Tu email',
          buttonText: 'Suscribirme',
        },
      },
    };
  },
};
