import { defineRouteConfig } from '@medusajs/admin-sdk';
import { TruckFast } from '@medusajs/icons';
import { Navigate } from 'react-router-dom';

/**
 * Parent "Andreani": registra el item del menú y redirige a Envíos. Las
 * secciones (Envíos, Configuración) son rutas hijas que el sidebar anida por
 * jerarquía de path — mismo patrón que Asistente IA / Typesense (el parent solo
 * redirige al primer hijo).
 */
const AndreaniIndex = () => <Navigate to="/andreani/envios" replace />;

const AndreaniIcon = () => <TruckFast style={{ color: '#FF8D4E' }} />;

export const config = defineRouteConfig({
  label: 'Andreani',
  icon: AndreaniIcon,
  rank: 70,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Andreani',
};

export default AndreaniIndex;
