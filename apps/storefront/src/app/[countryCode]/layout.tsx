import { headers } from 'next/headers';
import { getActiveTenant } from "@lib/site-config/active-tenant"
import { getSiteGateState } from "@lib/site-config/site-gate"
import SiteGateScreen from "@modules/site-gate/components/site-gate-screen"

/**
 * Punto de bloqueo de la página de contraseña (site gate).
 *
 * Envuelve TODO el storefront —los route groups (main), (catalogo), (checkout),
 * (b2b), (splash) y las páginas sueltas— así que un sitio con gate activo no
 * tiene ninguna URL navegable. Quedan afuera por construcción `/api/*` (donde
 * vive el desbloqueo), `/driver` (app del repartidor) y `/maintenance`.
 *
 * Cuando el gate está apagado esto es un passthrough: `getSiteGateState()` no
 * lee cookies y el árbol de abajo se renderiza igual que siempre.
 *
 * No renderizar `children` alcanza para que las páginas no se ejecuten: React
 * sólo invoca el elemento si se lo incluye en la salida.
 */
export default async function CountryLayout(props: {
  children: React.ReactNode
}) {
  if ((await headers()).get('x-puck-preview')) return <>{props.children}</>
  const gate = await getSiteGateState()

  if (!gate.locked) {
    return <>{props.children}</>
  }

  // El logo se pasa por prop: TenantProvider vive dentro de los route groups, así
  // que acá useTenantBrand() devolvería el logo de la tienda principal y no el
  // del demo (mismo patrón que el login del portal B2B con `storeLogo`).
  const tenant = await getActiveTenant()

  return (
    <SiteGateScreen
      brandName={tenant.name}
      length={gate.length}
      logo={tenant.assets?.logos?.main}
      scope={gate.scope}
    />
  )
}
