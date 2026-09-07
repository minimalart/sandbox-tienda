import { MedusaService } from '@medusajs/framework/utils';
import { LandingPage } from './models';

export const EMPTY_PUCK_DATA = { content: [], root: { props: {} } };

class LandingPageModuleService extends MedusaService({ LandingPage }) {
  /** URL-safe slug from a title (accent-folded, lowercased, hyphenated). */
  generateSlug(title: string): string {
    const base = (title || '')
      .toLowerCase()
      .normalize('NFD')
      // strip combining diacritical marks (U+0300–U+036F)
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96);
    return base || 'landing';
  }

  /** Returns a slug that is not used by another (non-deleted) landing page. */
  async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    const normalized = this.generateSlug(slug);
    let candidate = normalized;
    let suffix = 2;
    for (;;) {
      const existing = await this.listLandingPages({ slug: candidate });
      const taken = existing.some(
        (page: { id: string }) => page.id !== excludeId,
      );
      if (!taken) {
        return candidate;
      }
      candidate = `${normalized}-${suffix}`;
      suffix += 1;
    }
  }
}

export default LandingPageModuleService;
