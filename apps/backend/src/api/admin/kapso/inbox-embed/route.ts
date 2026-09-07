import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { getKapsoSettings } from '../../../../modules/kapso-whatsapp/settings';

/**
 * Devuelve la URL del iframe embebible del inbox de Kapso. La API key NUNCA viaja
 * al browser: solo se expone la `embed_url` (que ya es un token de un solo
 * propósito creado en el dashboard de Kapso → Project → Inbox Embeds).
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ embed_url: getKapsoSettings().inboxEmbedUrl });
}
