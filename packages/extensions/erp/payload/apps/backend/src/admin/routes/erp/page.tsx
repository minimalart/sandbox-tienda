import { defineRouteConfig } from '@medusajs/admin-sdk';
import { CloudArrowUp } from '@medusajs/icons';
import { Navigate } from 'react-router-dom';

/**
 * Item padre "ERP": registra el ítem del menú y redirige a Configuración. Las
 * secciones (Panel, Configuración, Logs, Ventas) son rutas hijas que el sidebar
 * anida por jerarquía de path — mismo patrón que Asistente IA (el parent solo
 * redirige al hijo principal).
 */
const ErpIndex = () => <Navigate to="/erp/configuracion" replace />;

const ErpIcon = () => <CloudArrowUp style={{ color: '#0EA5E9' }} />;

export const config = defineRouteConfig({
  label: 'ERP',
  icon: ErpIcon,
  rank: 92,
});

export const handle = {
  breadcrumb: () => 'ERP',
};

export default ErpIndex;
