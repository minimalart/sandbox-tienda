import { MedusaService } from '@medusajs/framework/utils';
import { PdfCatalog, PdfCatalogHotspot, PdfCatalogChannel } from './models';

export type HotspotInput = {
  type: 'product' | 'video' | 'text';
  page_index: number;
  pos_x: number;
  pos_y: number;
  product_id?: string | null;
  variant_id?: string | null;
  data?: Record<string, unknown> | null;
  sort_order?: number;
};

class PdfCatalogModuleService extends MedusaService({
  PdfCatalog,
  PdfCatalogHotspot,
  PdfCatalogChannel,
}) {
  /**
   * Reemplaza por completo los hotspots de un catálogo por la lista dada.
   * (Igual que shop_by_look: enviar la lista pisa la anterior.)
   */
  async replaceHotspots(catalogId: string, hotspots: HotspotInput[]): Promise<void> {
    const existing = await this.listPdfCatalogHotspots({ catalog_id: catalogId });
    if (existing.length) {
      await this.deletePdfCatalogHotspots(existing.map((e) => e.id));
    }
    if (hotspots.length) {
      await this.createPdfCatalogHotspots(
        hotspots.map((h, i) => ({
          type: h.type,
          page_index: h.page_index ?? 0,
          pos_x: h.pos_x ?? 50,
          pos_y: h.pos_y ?? 50,
          product_id: h.product_id ?? null,
          variant_id: h.variant_id ?? null,
          data: (h.data ?? null) as Record<string, unknown> | null,
          sort_order: h.sort_order ?? i,
          catalog_id: catalogId,
        }))
      );
    }
  }

  /**
   * Reconcilia en qué sales channels este catálogo es EL activo.
   *
   * Invariante "uno activo por canal": para cada canal deseado que hoy pertenece
   * a otro catálogo, se le "roba" (se borra la fila viva ajena) antes de crear la
   * propia; los canales que dejan de estar en la lista se desactivan. El índice
   * UNIQUE parcial sobre sales_channel_id respalda la invariante a nivel DB.
   */
  async reconcileChannels(catalogId: string, salesChannelIds: string[]): Promise<void> {
    const desired = new Set(salesChannelIds.filter((s) => typeof s === 'string' && s.length > 0));

    const current = await this.listPdfCatalogChannels({ catalog_id: catalogId });
    const currentByChannel = new Map(current.map((c) => [c.sales_channel_id, c]));

    // Desactivar los canales que este catálogo tenía y ya no están en la lista.
    const toRemove = current.filter((c) => !desired.has(c.sales_channel_id));
    if (toRemove.length) {
      await this.deletePdfCatalogChannels(toRemove.map((c) => c.id));
    }

    // Activar los canales nuevos, robándoselos a quien los tuviera.
    for (const sc of desired) {
      if (currentByChannel.has(sc)) continue; // ya es nuestro
      const held = await this.listPdfCatalogChannels({ sales_channel_id: sc });
      if (held.length) {
        await this.deletePdfCatalogChannels(held.map((h) => h.id));
      }
      await this.createPdfCatalogChannels({ sales_channel_id: sc, catalog_id: catalogId });
    }
  }

  /** Lista de sales_channel_ids donde este catálogo es el activo. */
  async getActiveChannelIds(catalogId: string): Promise<string[]> {
    const rows = await this.listPdfCatalogChannels({ catalog_id: catalogId });
    return rows.map((r) => r.sales_channel_id);
  }
}

export default PdfCatalogModuleService;
