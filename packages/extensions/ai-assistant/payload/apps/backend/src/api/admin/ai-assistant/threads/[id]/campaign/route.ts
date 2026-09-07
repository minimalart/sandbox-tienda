import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { AI_ASSISTANT_MODULE } from '../../../../../../modules/ai-assistant';
// BLOG_MODULE was extracted to @minimalart/mercatto-plugin-blog. Using the string
// literal 'blog' avoids coupling this in-tree module to the plugin package.
const BLOG_MODULE = 'blog';
import { BANNER_MODULE } from '../../../../../../modules/banner';
import { LANDING_PAGE_MODULE } from '../../../../../../modules/landing-page';
import type { AiStore } from '../../../../../../modules/ai-assistant/ai/agent';
import { findActiveCampaign, upsertCampaign } from '../../../../../../modules/ai-assistant/ai/campaign';

type AnyService = any;

/**
 * GET  /admin/ai-assistant/threads/:id/campaign — estado + checklist de la campaña
 *      activa del hilo (lo consumen los bloques campaign_checklist / campaign_preview).
 * POST /admin/ai-assistant/threads/:id/campaign-action — NO; las acciones van por el
 *      MISMO archivo con ?action o body.action (ver POST abajo): publicar/aplicar/
 *      guardar/cancelar. Son las ÚNICAS vías de "acción real": el click del usuario
 *      en el preview ES la confirmación explícita (no pasa por el LLM).
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AnyService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const { id } = req.params;
  const createdBy = req.auth_context?.actor_id ?? 'unknown';
  const thread = await service.retrieveChatThread(id).catch(() => null);
  if (!thread || thread.created_by !== createdBy) {
    res.status(404).json({ message: 'Hilo no encontrado.' });
    return;
  }
  const campaignId = typeof req.query.campaign_id === 'string' ? req.query.campaign_id : null;
  const row = await findActiveCampaign(service as AiStore, thread.id, campaignId);
  res.json({ campaign: row });
};

type CampaignAction =
  | 'apply_promotion'
  | 'publish_blog'
  | 'publish_banner'
  | 'publish_landing'
  | 'save_draft'
  | 'cancel';

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AnyService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const { id } = req.params;
  const createdBy = req.auth_context?.actor_id ?? 'unknown';
  const thread = await service.retrieveChatThread(id).catch(() => null);
  if (!thread || thread.created_by !== createdBy) {
    res.status(404).json({ message: 'Hilo no encontrado.' });
    return;
  }

  const body = (req.body ?? {}) as { action?: CampaignAction; campaign_id?: string };
  const action = body.action;
  if (!action) {
    res.status(400).json({ message: 'Falta `action`.' });
    return;
  }

  const row = await findActiveCampaign(service as AiStore, thread.id, body.campaign_id ?? null);
  if (!row) {
    res.status(404).json({ message: 'No hay campaña en curso en este hilo.' });
    return;
  }
  const outputs = row.state.outputs ?? {};
  const okText: string[] = [];

  try {
    if (action === 'apply_promotion') {
      const promoId = (outputs.promotion as Record<string, unknown> | null)?.promotion_id as string | undefined;
      if (!promoId) {
        res.status(400).json({ message: 'La campaña no tiene una promoción preparada.' });
        return;
      }
      const promotion: AnyService = req.scope.resolve(Modules.PROMOTION);
      await promotion.updatePromotions({ id: promoId, status: 'active' });
      okText.push('Promoción aplicada.');
    } else if (action === 'publish_blog') {
      const postId = (outputs.blog_post as Record<string, unknown> | null)?.post_id as string | undefined;
      if (!postId) {
        res.status(400).json({ message: 'La campaña no tiene una nota de blog.' });
        return;
      }
      const blog: AnyService = req.scope.resolve(BLOG_MODULE);
      await blog.updateBlogPosts({ id: postId, status: 'published', published_at: new Date() });
      okText.push('Nota publicada.');
    } else if (action === 'publish_banner') {
      const bannerId = (outputs.banner as Record<string, unknown> | null)?.banner_id as string | undefined;
      if (!bannerId) {
        res.status(400).json({ message: 'La campaña no tiene un banner.' });
        return;
      }
      const banner: AnyService = req.scope.resolve(BANNER_MODULE);
      await banner.updateBanners({ id: bannerId, status: 'published' });
      okText.push('Banner publicado.');
    } else if (action === 'publish_landing') {
      const landingId = (outputs.landing as Record<string, unknown> | null)?.landing_id as string | undefined;
      if (!landingId) {
        res.status(400).json({ message: 'La campaña no tiene una landing.' });
        return;
      }
      const landing: AnyService = req.scope.resolve(LANDING_PAGE_MODULE);
      await landing.updateLandingPages({ id: landingId, status: 'published', published_at: new Date() });
      okText.push('Landing publicada.');
    } else if (action === 'save_draft') {
      okText.push('Campaña guardada como borrador.');
    } else if (action === 'cancel') {
      const cancelled = await upsertCampaign({
        store: service as AiStore,
        threadId: thread.id,
        campaignId: row.id,
        statusOverride: 'cancelled',
      });
      res.json({ ok: true, message: 'Campaña cancelada.', campaign: cancelled });
      return;
    } else {
      res.status(400).json({ message: `Acción desconocida: ${action}` });
      return;
    }
  } catch (e) {
    res.status(500).json({ message: `No se pudo ejecutar la acción: ${(e as Error).message}` });
    return;
  }

  const status = action === 'save_draft' ? 'draft' : 'confirmed';
  const updated = await upsertCampaign({
    store: service as AiStore,
    threadId: thread.id,
    campaignId: row.id,
    statusOverride: status,
  });
  res.json({ ok: true, message: okText.join(' '), campaign: updated });
};
