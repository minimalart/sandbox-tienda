import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Trophy } from '@medusajs/icons';
import { Navigate } from 'react-router-dom';

/**
 * Parent "Fidelización" item: registers the sidebar entry and redirects to
 * Configuración. Sections (Configuración, Reglas, …) are child routes the
 * sidebar nests by path hierarchy — same pattern as ERP / Asistente IA.
 */
const LoyaltyIndex = () => <Navigate to="/loyalty/dashboard" replace />;

const LoyaltyIcon = () => <Trophy style={{ color: '#D97706' }} />;

export const config = defineRouteConfig({
  label: 'Fidelización',
  icon: LoyaltyIcon,
  rank: 50,
});

export const handle = {
  breadcrumb: () => 'Fidelización',
};

export default LoyaltyIndex;
