import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ERP_MODULE } from '../../../../modules/erp';
import type ErpModuleService from '../../../../modules/erp/service';
import type { TintingBaseRow } from '../../../../modules/erp/service';
import { normalizePresentationLabel } from '../../../../modules/erp/sync/product-title';
import { readColorImages } from '../../../../modules/erp/tinting/color-images';
import type { ErpConfigSettings } from '../../../../modules/erp/types';
import { loadCartContext, loadRegionContext, loadVariantsBySku } from '../context';

/**
 * GET /store/tinting/bases?color_code=&collection=&... — con qué productos se
 * logra un color (flujo inverso color → base).
 *
 * Devuelve UN item por PRODUCTO de Medusa, no por línea de producto: cada envase
 * es un artículo distinto del ERP y entra a Medusa como su propio producto, así
 * que unificar los tamaños de una línea en una sola card la hacía la única
 * pantalla del sitio donde un producto no tiene su card —el PLP y el buscador
 * muestran el balde de 4 y el de 20 por separado— y el comprador tenía que elegir
 * el envase con una gramática que no existe en ninguna otra parte.
 *
 * Vienen ordenados por línea y tamaño ascendente (lo hace
 * `selectBasesForColor`), así que los envases de la misma línea quedan juntos.
 *
 * El agrupador sobrevive por un caso real: un producto con VARIAS variantes de
 * presentación. Ahí la card es del producto y los envases van como chips, igual
 * que en el PDP.
 *
 * NO cotiza contra el ERP: devuelve el precio de catálogo de cada base. Cotizar
 * las N bases sería N llamadas de hasta 6s a Zeus para calentar una caché por
 * artículo de la que el comprador usa una sola. El precio con color lo pide el
 * storefront con POST /store/tinting/quote recién cuando se elige un envase.
 *
 * `private, no-store`: la respuesta depende de región, canal y grupos del
 * cliente (el mayorista cotiza con su lista), así que cachearla pública filtraría
 * precios mayoristas a retail.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const config = await service.getActiveConfig().catch(() => null);
  const settings = (config?.settings ?? {}) as ErpConfigSettings;

  if (!settings.tinting?.enabled) {
    res.status(404).json({ message: 'El sistema tintométrico no está disponible.' });
    return;
  }

  const colorCode = String(req.query.color_code ?? '').trim();
  if (!colorCode) {
    res.status(400).json({ message: 'Falta color_code.' });
    return;
  }
  // La carta es obligatoria: el código de color sólo es único por `(carta,
  // código)`, y resolver con la carta equivocada cobraría otro color.
  const collection = String(req.query.collection ?? '').trim();
  if (!collection) {
    res.status(400).json({ message: 'Falta collection.' });
    return;
  }

  const salesChannelId = String(req.query.sales_channel_id ?? '').trim() || null;
  const cartId = String(req.query.cart_id ?? '').trim() || null;
  const countryCode = String(req.query.country_code ?? '').trim() || null;

  res.setHeader('Cache-Control', 'private, no-store');

  try {
    const matches = await service.listTintingBasesForColor({
      color_code: colorCode,
      collection,
    });
    if (!matches.length) {
      res.json({ color: null, lines: [] });
      return;
    }

    const [color] = await service.listErpTintingColors(
      { code: colorCode, collection, active: true },
      { take: 1 }
    );

    const cart = cartId ? await loadCartContext(req, cartId) : null;
    const priceContext =
      cart ?? (countryCode ? await loadRegionContext(req, countryCode) : null);

    const bases = matches.map((match) => match.base);
    const variants = await loadVariantsBySku(
      req,
      bases.map((base) => base.article_code),
      priceContext,
      salesChannelId
    );

    // Una base sin variante en este canal no se puede comprar acá: se descarta.
    // El conteo se loguea porque suele significar data maestra desincronizada
    // (base confirmada cuyo producto nunca se sincronizó o quedó en draft).
    const grouped = new Map<
      string,
      {
        key: string;
        product_line: string;
        product: Record<string, unknown> | null;
        sizes: unknown[];
      }
    >();
    let dropped = 0;

    for (const base of bases as TintingBaseRow[]) {
      const variant = variants.get(base.article_code);
      if (!variant) {
        dropped += 1;
        continue;
      }

      // La card es del PRODUCTO. Sin `product_id` (no debería pasar: la variante
      // salió de una consulta que lo trae) cae al artículo, que es único por
      // definición: peor una card de más que perder un envase vendible.
      const key = variant.product_id ?? base.article_code;
      let group = grouped.get(key);
      if (!group) {
        group = {
          key,
          product_line: base.product_line,
          product: {
            id: variant.product_id,
            handle: variant.product_handle,
            title: variant.product_title,
            thumbnail: variant.thumbnail,
          },
          sizes: [],
        };
        grouped.set(key, group);
      }
      group.sizes.push({
        article_code: base.article_code,
        // Normalizado y con el envase redondeado (R25): el chip tiene que decir
        // lo MISMO que el título del producto que está arriba, y el ERP lo carga
        // como `3,6 LTS` (contenido de base) mientras el título dice `x4 lt`.
        //
        // Sin `size_label` la etiqueta se deriva de `size_liters` por la MISMA
        // regla, y no se manda el litraje pelado: `size_liters` es el contenido
        // de base que usa el motor para cotizar (8,7), así que dejar que la card
        // lo muestre como envase es justo la contradicción que pide arreglar
        // DESDEELSUR-27 —y encima saldría con punto decimal, `8.7 lt`—.
        size_label:
          normalizePresentationLabel(base.size_label, { tintBase: true }) ??
          normalizePresentationLabel(
            base.size_liters !== null && base.size_liters !== undefined
              ? `${base.size_liters} lt`
              : null,
            { tintBase: true }
          ) ??
          base.size_label,
        size_liters: base.size_liters,
        base_letter: base.base_letter,
        variant_id: variant.variant_id,
        base_price: variant.base_unit_price,
        currency_code: variant.currency_code,
      });
    }

    if (dropped > 0) {
      console.warn(
        `[tinting] bases: ${dropped} base(s) sin variante vendible para ${collection}/${colorCode}` +
          (salesChannelId ? ` en el canal ${salesChannelId}` : '')
      );
    }

    res.json({
      color: color
        ? {
            code: color.code,
            name: color.name,
            collection: color.collection,
            hex: color.hex,
            family: color.family,
            // Las fotos de ambiente van SÓLO acá y no en `/store/tinting/catalog`:
            // la carta completa son miles de swatches y sumarle 8 URLs a cada uno
            // infla una respuesta que se cachea pública. Este endpoint ya es de un
            // color solo, que es exactamente cuando la foto se muestra.
            images: readColorImages(color.metadata),
          }
        : null,
      lines: [...grouped.values()],
    });
  } catch (error) {
    console.error('[tinting] bases error:', error instanceof Error ? error.stack : error);
    res.status(424).json({
      message: 'No pudimos buscar los productos para ese color en este momento.',
      degraded: true,
    });
  }
}
