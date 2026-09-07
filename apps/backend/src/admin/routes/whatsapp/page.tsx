import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ChatBubbleLeftRight } from '@medusajs/icons';
import { Navigate } from 'react-router-dom';

/**
 * Parent "WhatsApp": registra el item del menú y redirige a la Bandeja. Las
 * secciones (Bandeja, Templates) son rutas hijas que el sidebar anida por
 * jerarquía de path — mismo patrón que Asistente IA / Delivery / Typesense.
 */
const WhatsAppIndex = () => <Navigate to="/whatsapp/inbox" replace />;

export const config = defineRouteConfig({
  label: 'WhatsApp',
  icon: ChatBubbleLeftRight,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'WhatsApp',
};

export default WhatsAppIndex;
