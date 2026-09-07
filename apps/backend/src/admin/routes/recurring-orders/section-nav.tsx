import { Button } from '@medusajs/ui';
import { useLocation, useNavigate } from 'react-router-dom';

const links = [
  ['/recurring-orders', 'Suscripciones'],
  ['/recurring-orders/plans', 'Planes'],
  ['/recurring-orders/renewals', 'Renovaciones'],
  ['/recurring-orders/forecast', 'Demanda futura'],
  ['/recurring-orders/incidents', 'Incidentes'],
  ['/recurring-orders/analytics', 'Métricas'],
  ['/recurring-orders/cancellation-reasons', 'Cancelación'],
  ['/recurring-orders/settings', 'Configuración'],
] as const;

export function SubscriptionSectionNav() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <nav aria-label="Secciones de suscripciones" className="flex flex-wrap gap-2 border-b px-6 py-3">
      {links.map(([href, label]) => (
        <Button
          key={href}
          size="small"
          variant={location.pathname === href ? 'primary' : 'secondary'}
          onClick={() => navigate(href)}
        >
          {label}
        </Button>
      ))}
    </nav>
  );
}
