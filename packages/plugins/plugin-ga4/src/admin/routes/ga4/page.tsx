import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ChartBar } from '@medusajs/icons';
import { Navigate } from 'react-router-dom';

// Ruta padre de GA4: solo agrupa el sidebar (Eventos / Configuración) y
// redirige a la sub-ruta "Eventos" por defecto.
const Ga4Redirect = () => <Navigate to="/ga4/events" replace />;

const Ga4Icon = () => <ChartBar style={{ color: '#7270F5' }} />;

export const config = defineRouteConfig({
  label: 'GA4',
  icon: Ga4Icon,
  rank: 90,
});

export const handle = {
  breadcrumb: () => 'GA4',
};

export default Ga4Redirect;
