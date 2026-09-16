import { getPwaBrand } from "@lib/site-config/pwa";
import DriverLoginForm from "@modules/driver/components/login-form";

/**
 * Login del repartidor.
 *
 * Server Component fino: resuelve la marca de la tienda activa y se la pasa al
 * formulario, que es el que necesita estado de cliente.
 */
export default async function DriverLoginPage() {
  const { name } = await getPwaBrand();

  return <DriverLoginForm brand={name} />;
}
