import { defineRouteConfig } from '@medusajs/admin-sdk';
import { MagnifyingGlass } from '@medusajs/icons';
import { Navigate } from 'react-router-dom';

/**
 * Ítem padre "SEO & GEO": registra la entrada del sidebar y redirige al
 * dashboard. Las secciones (Dashboard, Auditorías, Hallazgos, …) son rutas hijas
 * que el sidebar anida por jerarquía de path — mismo patrón que Fidelización.
 */
const SeoGeoIndex = () => <Navigate to="/seo-geo/dashboard" replace />;

const SeoGeoIcon = () => <MagnifyingGlass style={{ color: '#2563EB' }} />;

export const config = defineRouteConfig({
  label: 'SEO & GEO',
  icon: SeoGeoIcon,
  rank: 55,
});

export const handle = { breadcrumb: () => 'SEO & GEO' };

export default SeoGeoIndex;
