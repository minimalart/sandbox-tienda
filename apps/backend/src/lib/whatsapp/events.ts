import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import {
  WHATSAPP_EVENT_LOG_MODULE,
  type WaEventType,
} from '../../modules/whatsapp-agent/event-log/types';

type WhatsappEventLogService = {
  createWhatsappEvents: (data: Record<string, unknown>) => Promise<unknown>;
};

export type WaEventInput = {
  phone: string;
  type: WaEventType;
  /** Dimensión del asesor guiado, cuando el evento pertenece a un paso. */
  step?: string | null;
  payload?: Record<string, unknown> | null;
  /** `true` sólo si el turno consumió el LLM. Ver PRD §30.19. */
  usedAi?: boolean;
  sessionId?: string | null;
  /**
   * La tienda que recibió el mensaje, tomada de `?site=` en la URL del webhook.
   * `null`/ausente cuando la cuenta de Kapso todavía apunta a la URL sin parámetro.
   */
  siteId?: string | null;
};

/**
 * Registra un paso del embudo comercial de WhatsApp.
 *
 * **Best-effort por diseño**: la analítica NUNCA puede voltear un turno de venta,
 * así que cualquier falla (módulo no registrado, tabla sin migrar, DB caída) se
 * traga con un `debug` y el flujo sigue. Por eso no devuelve nada útil ni hay que
 * `await`earlo en el camino crítico.
 *
 * El módulo se resuelve por llamada y no se cachea: en Medusa el contenedor es
 * por request (scoped), así que guardar la instancia filtraría el scope.
 */
export async function logWaEvent(
  container: MedusaContainer,
  event: WaEventInput,
): Promise<void> {
  try {
    const svc = container.resolve<WhatsappEventLogService>(WHATSAPP_EVENT_LOG_MODULE);
    await svc.createWhatsappEvents({
      phone: event.phone,
      session_id: event.sessionId ?? null,
      type: event.type,
      step: event.step ?? null,
      payload: event.payload ?? null,
      used_ai: event.usedAi === true,
      site_id: event.siteId ?? null,
    });
  } catch (err) {
    try {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
      logger.debug(
        `[WhatsApp bot] No se pudo registrar el evento "${event.type}": ${(err as Error).message}`,
      );
    } catch {
      /* noop — ni el logger está disponible */
    }
  }
}

/**
 * Variante fire-and-forget para el camino crítico: no hay que esperar a que la
 * fila se escriba para poder contestarle al cliente.
 */
export function trackWaEvent(container: MedusaContainer, event: WaEventInput): void {
  void logWaEvent(container, event);
}
