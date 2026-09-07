import "server-only";

import { cache } from "react";
import { sdk } from "@lib/config";

export type WhatsappFloatingButton = {
  /** Teléfono normalizado por el backend (solo dígitos, sin `+`). */
  phone: string;
  /** Mensaje pre-cargado en el chat (puede venir vacío). */
  message: string;
  /** Nombre accesible / tooltip. */
  label: string;
};

/**
 * Config del botón flotante de WhatsApp, administrada en Admin → WhatsApp →
 * Ajustes. Cacheada por request con `cache()` porque la lee el layout.
 *
 * Devuelve null cuando el toggle está apagado, cuando falta el teléfono o ante
 * cualquier error (backend viejo sin el endpoint incluido): la tienda nunca se
 * rompe y simplemente no se monta el botón.
 */
export const getWhatsappFloatingButton = cache(
  async (): Promise<WhatsappFloatingButton | null> => {
    try {
      const data = await sdk.client.fetch<{
        floating_button?: Partial<WhatsappFloatingButton> | null;
      }>("/store/whatsapp/floating-button", {
        method: "GET",
        // El layout se renderiza en todas las páginas: cacheamos un minuto para
        // no pegarle al backend en cada navegación, sin que activar el toggle
        // tarde en verse.
        next: { revalidate: 60 },
      });

      const config = data?.floating_button;
      const phone = String(config?.phone ?? "").replace(/\D/g, "");
      if (!phone) return null;

      return {
        phone,
        message: typeof config?.message === "string" ? config.message : "",
        label:
          typeof config?.label === "string" && config.label.trim() !== ""
            ? config.label
            : "Escribinos por WhatsApp",
      };
    } catch {
      return null;
    }
  },
);
