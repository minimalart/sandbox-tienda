import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { WHATSAPP_AGENT_MODULE } from '../../../modules/whatsapp-agent';
import type WhatsappAgentModuleService from '../../../modules/whatsapp-agent/service';

type Row = {
  id: string;
  phone: string;
  status: string;
  escalated_at: string | Date | null;
  escalation_reason: string | null;
  customer_id: string | null;
  email: string | null;
  updated_at: string | Date | null;
};

/**
 * GET /admin/whatsapp-conversations — conversaciones de WhatsApp recientes (con su
 * estado bot/atención-humana), para el panel del backoffice.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<WhatsappAgentModuleService>(WHATSAPP_AGENT_MODULE);
  const rows = (await service.listRecent(20)) as Row[];
  res.json({
    conversations: rows.map((r) => ({
      id: r.id,
      phone: r.phone,
      status: r.status ?? 'bot',
      escalated_at: r.escalated_at,
      escalation_reason: r.escalation_reason,
      customer_id: r.customer_id,
      email: r.email,
      updated_at: r.updated_at,
    })),
  });
};

/**
 * POST /admin/whatsapp-conversations — cambia el modo de una conversación.
 * Body: { phone, action: 'pause' | 'resume' }. `pause` = el operador la atiende
 * (el bot deja de responder); `resume` = vuelve al bot. Default: resume.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as { phone?: string; action?: string };
  const phone = body.phone?.trim();
  const action = body.action === 'pause' ? 'pause' : 'resume';
  if (!phone) {
    res.status(400).json({ message: 'phone es obligatorio.' });
    return;
  }
  const service = req.scope.resolve<WhatsappAgentModuleService>(WHATSAPP_AGENT_MODULE);
  if (action === 'pause') await service.takeOver(phone);
  else await service.resume(phone);
  res.json({ ok: true, phone, action });
};
