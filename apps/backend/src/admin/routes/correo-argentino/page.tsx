import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Mailbox } from '@medusajs/icons';
import { Navigate } from 'react-router-dom';

/**
 * Parent "Correo Argentino": registra el item del menú y redirige a Envíos. Las
 * secciones (Envíos, Configuración) son rutas hijas que el sidebar anida por
 * jerarquía de path — mismo patrón que Andreani / Asistente IA / Typesense.
 *
 * `rank: 71` para quedar inmediatamente después de Andreani (70) y antes de
 * Comentarios / Configuración de tienda (80): los dos carriers juntos en el
 * sidebar. Ranks vecinos ocupados hoy: 60 (Sucursales), 70 (Andreani), 80.
 *
 * ⚠️ ÍCONO GENÉRICO A PROPÓSITO: `Mailbox` de `@medusajs/icons` (Andreani usa
 * `TruckFast`, así que los dos se distinguen en el sidebar). No hay asset oficial
 * de Correo Argentino en el repo y NO se inventa uno: dibujar la marca sin el
 * asset que provea el negocio sería falsificarla.
 *
 * PENDIENTE DEL NEGOCIO: logo oficial de Correo Argentino. Cuando llegue, va acá
 * y en `apps/storefront/public/` para el badge del checkout.
 *
 * Tampoco se le pone color al ícono, a diferencia de Andreani (que usa su naranja
 * corporativo): un color elegido a ojo es tan inventado como un SVG.
 */
const CorreoArgentinoIndex = () => (
  <Navigate to="/correo-argentino/envios" replace />
);

export const config = defineRouteConfig({
  label: 'Correo Argentino',
  icon: Mailbox,
  rank: 71,
});

// Breadcrumb del header superior, igual que las páginas nativas de Medusa.
export const handle = {
  breadcrumb: () => 'Correo Argentino',
};

export default CorreoArgentinoIndex;
