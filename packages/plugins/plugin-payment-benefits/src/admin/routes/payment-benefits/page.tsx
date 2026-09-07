import { defineRouteConfig } from '@medusajs/admin-sdk';
import { CreditCard } from '@medusajs/icons';
import { Navigate } from 'react-router-dom';

/**
 * Sección "Beneficios de Pago". Registrar la ruta en /payment-benefits la hace
 * el ítem padre del menú; las rutas hijas (benefits, settings) anidan por
 * jerarquía de path. La página raíz reenvía al listado de beneficios.
 */
const PaymentBenefitsIndex = () => <Navigate to="/payment-benefits/benefits" replace />;

const PaymentBenefitsIcon = () => <CreditCard style={{ color: '#0EA5E9' }} />;

export const config = defineRouteConfig({
  label: 'Beneficios de Pago',
  icon: PaymentBenefitsIcon,
  rank: 44,
});

export const handle = {
  breadcrumb: () => 'Beneficios de Pago',
};

export default PaymentBenefitsIndex;
