import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { STORE_CONFIG_MODULE } from '../../../../modules/store-config';
import StoreConfigModuleService, {
  STORE_SETTING_KEYS,
} from '../../../../modules/store-config/service';
import { findBarcodeVariant, normalizeBarcode } from '../match';
import { siteIdFromPublishableKey } from '../../../../lib/multistore/publishable-key';

type VariantLookupRow = {
  id: string;
  title?: string | null;
  sku?: string | null;
  barcode?: string | null;
  ean?: string | null;
  upc?: string | null;
  metadata?: Record<string, unknown> | null;
  product?: {
    id: string;
    title?: string | null;
    handle?: string | null;
    thumbnail?: string | null;
    status?: string | null;
  } | null;
};

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    // El toggle de MI tienda: es el MISMO que publica `GET /store/store-config`, y si
    // los dos no leen la misma fila el storefront esconde el escáner y el endpoint lo
    // sigue atendiendo (o al revés, lo muestra y devuelve 403).
    const enabled = await service.getBooleanSetting(
      STORE_SETTING_KEYS.BARCODE_SCANNER_ENABLED,
      false,
      await siteIdFromPublishableKey(req),
    );

    if (!enabled) {
      return res.status(403).json({
        enabled: false,
        message: 'Barcode scanner is disabled',
      });
    }

    const code = String(req.query.code ?? '').trim();
    if (!code) {
      return res.status(400).json({ enabled: true, message: 'code is required' });
    }

    // Candidatos a matchear contra las columnas de la variante. Incluimos el
    // código tal cual y su forma normalizada (sin espacios/guiones, lower) que
    // es como guardamos sku/barcode. Esto reemplaza el viejo "cargar TODOS los
    // productos y escanear en JS" (lentísimo con catálogos grandes) por una
    // query filtrada server-side.
    const normalized = normalizeBarcode(code);
    const candidates = [...new Set([code, normalized].filter(Boolean))] as string[];

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data: variants } = (await query.graph({
      entity: 'product_variant',
      fields: [
        'id',
        'title',
        'sku',
        'barcode',
        'ean',
        'upc',
        'metadata',
        'product.id',
        'product.title',
        'product.handle',
        'product.thumbnail',
        'product.status',
      ],
      filters: {
        $or: [
          { sku: candidates },
          { barcode: candidates },
          { ean: candidates },
          { upc: candidates },
        ],
      },
      pagination: { take: 50, skip: 0 },
    })) as { data: VariantLookupRow[] };

    // Reagrupamos en la forma { ...product, variants:[variant] } que espera
    // findBarcodeVariant, así reusamos su normalización/precedencia (incluye los
    // campos en metadata) sobre el puñado de variantes que devolvió la query.
    const products = (variants ?? [])
      .filter((v) => v.product && v.product.status === 'published')
      .map((v) => ({
        id: v.product!.id,
        title: v.product!.title ?? null,
        handle: v.product!.handle ?? null,
        thumbnail: v.product!.thumbnail ?? null,
        variants: [
          {
            id: v.id,
            title: v.title ?? null,
            sku: v.sku ?? null,
            barcode: v.barcode ?? null,
            ean: v.ean ?? null,
            upc: v.upc ?? null,
            metadata: v.metadata ?? null,
          },
        ],
      }));

    const match = findBarcodeVariant(code, products);
    if (!match) {
      return res.status(404).json({
        enabled: true,
        message: 'Product not found for barcode',
      });
    }

    return res.status(200).json({
      enabled: true,
      product: match,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error looking up barcode product';
    console.error('[Store BarcodeScanner] Lookup error:', message);
    return res.status(500).json({ message });
  }
}
