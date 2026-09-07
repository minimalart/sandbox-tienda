import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { validateGa4Event } from '../../../../modules/ga4/lib/measurement-protocol';
import { GA4_MODULE } from '../../../../modules/ga4';
import type Ga4ModuleService from '../../../../modules/ga4/service';

/** Evento sintético que dispara la prueba de conexión (no es un evento real). */
const TEST_EVENT_NAME = 'ga4_connection_test';
const TEST_EVENT_PARAMS = {
  engagement_time_msec: 1,
  debug_source: 'medusa_admin',
} as const;

/**
 * POST /admin/ga4-config/test — dispara un evento de prueba contra el endpoint
 * /debug/mp/collect de GA4 y devuelve los validationMessages de Google.
 *
 * Usa la config efectiva (app-settings > fila legacy ga4_settings > env). NO
 * registra un hit real (usa
 * siempre el endpoint debug), así que el admin puede confirmar que la config
 * (measurement id + api secret) y el payload son correctos sin ensuciar la
 * propiedad de GA4. `valid: true` + sin mensajes = todo OK.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const ga4Service = req.scope.resolve<Ga4ModuleService>(GA4_MODULE);
  const config = await ga4Service.getSendConfig();

  if (!config) {
    res.status(400).json({
      valid: false,
      configured: false,
      event_name: TEST_EVENT_NAME,
      validation_messages: [],
      message: 'measurement_id and api_secret must be set in the GA4 config.',
    });
    return;
  }

  try {
    const result = await validateGa4Event({
      clientId: '555.0', // client_id sintético con formato válido para la prueba
      eventName: TEST_EVENT_NAME,
      params: { ...TEST_EVENT_PARAMS },
      config,
    });

    res.status(200).json({
      valid: result.ok && result.validationMessages.length === 0,
      configured: true,
      event_name: TEST_EVENT_NAME,
      status: result.status,
      validation_messages: result.validationMessages,
    });
  } catch (error) {
    res.status(500).json({
      valid: false,
      configured: true,
      event_name: TEST_EVENT_NAME,
      validation_messages: [],
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
