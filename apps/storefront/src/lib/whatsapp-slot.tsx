// GENERADO por packages/project-composer (renderWhatsappFloatingSlot).
// No editar a mano: lo reescribe `pnpm site:components:extract` y `pnpm site:create`.
import { getWhatsappFloatingButton } from '@lib/data/whatsapp'
import WhatsappFloatingButton from '@modules/whatsapp/components/floating-button'

export const whatsappFloatingButtonAvailable = true

/**
 * Monta el botón flotante solo si está activado en Admin → WhatsApp → Ajustes y
 * tiene un teléfono válido; si no, no renderiza nada.
 */
export async function WhatsappFloatingButtonSlot() {
  const config = await getWhatsappFloatingButton()
  if (!config) return null
  return <WhatsappFloatingButton label={config.label} message={config.message} phone={config.phone} />
}
