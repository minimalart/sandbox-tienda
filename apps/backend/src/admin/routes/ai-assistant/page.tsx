import { defineRouteConfig } from '@medusajs/admin-sdk';
import { SparklesSolid } from '@medusajs/icons';
import { Navigate } from 'react-router-dom';

/**
 * Parent "Asistente IA": registra el item del menú y redirige al Chat. Las
 * secciones (Chat, Propuestas, Agentes, Trazas, Configuración) son rutas hijas
 * que el sidebar anida por jerarquía de path — mismo patrón que Blog/Delivery/
 * Typesense (el parent solo redirige al primer hijo).
 */
const AiAssistantIndex = () => <Navigate to="/ai-assistant/chat" replace />;

const AiAssistantIcon = () => <SparklesSolid style={{ color: '#1D9E75' }} />;

export const config = defineRouteConfig({
  label: 'Asistente IA',
  icon: AiAssistantIcon,
  rank: 15,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Asistente IA',
};

export default AiAssistantIndex;
