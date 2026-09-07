import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { STORE_CONFIG_MODULE } from '../../../../modules/store-config';
import {
  isFloatingButtonLive,
  readFloatingButtonConfig,
  type StoreSettingReader,
} from '../../../../modules/kapso-whatsapp/floating-button';
import { siteIdFromPublishableKey } from '../../../../lib/multistore/publishable-key';

/**
 * GET /store/whatsapp/floating-button — config pública del botón flotante.
 *
 * Devuelve `{ floating_button: null }` cuando el toggle está apagado, cuando no
 * hay teléfono válido o ante cualquier error: el storefront no monta nada y la
 * tienda nunca se rompe por esto. Solo expone lo que el botón necesita — nada
 * de credenciales de Kapso.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve<StoreSettingReader>(STORE_CONFIG_MODULE);
    /**
     * El botón de MI tienda. `readFloatingButtonConfig` acepta `siteId` desde que el
     * admin escribe por tienda (`admin/kapso/floating-button` ya lo pasa), pero la
     * punta pública seguía leyendo la fila global: el operador guardaba SU teléfono y
     * el storefront mandaba a los clientes al WhatsApp de otro negocio.
     *
     * De todo lo que se corrige en esta pasada, es lo único que saca a la persona del
     * sitio: la conversación arranca en el número equivocado y ahí ya no hay forma de
     * detectarlo desde el backend.
     */
    const config = await readFloatingButtonConfig(
      service,
      await siteIdFromPublishableKey(req),
    );
    if (!isFloatingButtonLive(config)) {
      res.status(200).json({ floating_button: null });
      return;
    }
    res.status(200).json({
      floating_button: {
        phone: config.phone,
        message: config.message,
        label: config.label,
      },
    });
  } catch (error) {
    console.error('[Store WhatsApp] Error reading floating button config:', error);
    res.status(200).json({ floating_button: null });
  }
}
