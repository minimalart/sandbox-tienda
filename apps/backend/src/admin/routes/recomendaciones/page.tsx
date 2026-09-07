import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Sparkles } from '@medusajs/icons';
import { Navigate } from 'react-router-dom';

/**
 * Ítem padre "Recomendaciones": registra la entrada del sidebar y redirige a
 * Configuración. Las secciones (Configuración, Relaciones, Rendimiento) son rutas
 * hijas que el sidebar anida por jerarquía de path — mismo patrón que Fidelización y
 * SEO & GEO.
 */
const RecommendationsIndex = () => <Navigate to="/recomendaciones/configuracion" replace />;

const RecommendationsIcon = () => <Sparkles style={{ color: '#7C3AED' }} />;

export const config = defineRouteConfig({
  label: 'Recomendaciones',
  icon: RecommendationsIcon,
  rank: 46,
});

export const handle = { breadcrumb: () => 'Recomendaciones' };

export default RecommendationsIndex;
