import { MedusaService } from '@medusajs/framework/utils';
import { Banner, BannerAnalytics, BannerAudit } from './models';
import type { BannerRules, StoreBannerQuery } from './types';

class BannerModuleService extends MedusaService({
  Banner,
  BannerAudit,
  BannerAnalytics,
}) {
  private parseJsonField<T>(value: unknown): T | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value as T;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    }
    return null;
  }

  async resolveBanners(query: StoreBannerQuery): Promise<any[]> {
    const now = new Date();
    const placements = Array.isArray(query.placement) ? query.placement : [query.placement];

    const banners = await this.listBanners({
      status: 'published',
      placement: placements,
    });

    const parsed = banners.map((banner) => ({
      ...banner,
      content: this.parseJsonField(banner.content),
      media: this.parseJsonField(banner.media),
      cta: this.parseJsonField(banner.cta),
      rules: this.parseJsonField(banner.rules),
      metadata: this.parseJsonField(banner.metadata),
    }));

    const filtered = parsed.filter((banner) => {
      if (banner.start_at && new Date(banner.start_at) > now) {
        return false;
      }
      if (banner.end_at && new Date(banner.end_at) <= now) {
        return false;
      }

      if (!this.matchRules(banner.rules as BannerRules | null, query)) {
        return false;
      }

      return true;
    });

    filtered.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    return filtered;
  }

  private matchRules(rules: BannerRules | null, query: StoreBannerQuery): boolean {
    // Scoping estricto por canal (contexto demo): el banner debe estar
    // explícitamente asignado al canal pedido. Excluye globales/sin canal.
    if (query.require_sales_channel) {
      const scoped = rules?.sales_channel_ids ?? [];
      if (!query.sales_channel_id || !scoped.includes(query.sales_channel_id)) {
        return false;
      }
    }

    if (!rules) return true;

    if (rules.sales_channel_ids?.length) {
      if (!query.sales_channel_id) return false;
      if (!rules.sales_channel_ids.includes(query.sales_channel_id)) {
        return false;
      }
    }

    if (rules.customer_group_ids?.length) {
      const queryGroupIds = [
        ...(query.customer_group_id ? [query.customer_group_id] : []),
        ...(query.customer_group_ids ?? []),
      ];
      if (queryGroupIds.length === 0) return false;
      if (!rules.customer_group_ids.some((id) => queryGroupIds.includes(id))) {
        return false;
      }
    }

    if (rules.locales?.length) {
      if (!query.locale) return false;
      if (!rules.locales.includes(query.locale)) {
        return false;
      }
    }

    if (rules.countries?.length) {
      if (!query.country) return false;
      if (!rules.countries.includes(query.country)) {
        return false;
      }
    }

    if (rules.devices?.length) {
      if (!query.device) return false;
      if (!rules.devices.includes(query.device)) {
        return false;
      }
    }

    if (rules.paths?.length && query.path) {
      const matched = rules.paths.some((pattern) => this.matchPath(pattern, query.path!));
      if (!matched) return false;
    }

    return true;
  }

  private matchPath(pattern: string, path: string): boolean {
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '{{DOUBLE}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{DOUBLE}}/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  generateHandle(internalName: string): string {
    return internalName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async createAuditEntry(
    bannerId: string,
    action: string,
    userId?: string,
    changes?: Record<string, unknown>,
    snapshot?: Record<string, unknown>,
  ): Promise<void> {
    await (this as any).createBannerAudits({
      banner_id: bannerId,
      action,
      user_id: userId,
      changes,
      snapshot,
    });
  }

  async trackImpression(bannerId: string): Promise<void> {
    const existing = await this.listBannerAnalytics({ banner_id: bannerId });
    const current = existing[0];

    if (current) {
      await (this as any).updateBannerAnalytics({
        id: current.id,
        impressions: (current.impressions ?? 0) + 1,
        last_impression_at: new Date(),
      });
    } else {
      await (this as any).createBannerAnalytics({
        banner_id: bannerId,
        impressions: 1,
        clicks: 0,
        last_impression_at: new Date(),
      });
    }
  }

  async trackClick(bannerId: string): Promise<void> {
    const existing = await this.listBannerAnalytics({ banner_id: bannerId });
    const current = existing[0];

    if (current) {
      await (this as any).updateBannerAnalytics({
        id: current.id,
        clicks: (current.clicks ?? 0) + 1,
        last_click_at: new Date(),
      });
    } else {
      await (this as any).createBannerAnalytics({
        banner_id: bannerId,
        impressions: 0,
        clicks: 1,
        last_click_at: new Date(),
      });
    }
  }
}

export default BannerModuleService;
