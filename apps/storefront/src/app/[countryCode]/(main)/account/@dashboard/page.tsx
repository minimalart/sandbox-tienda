import { getActiveSitePrefix } from "@lib/site-config/active-tenant";
import { withSitePrefix } from "@lib/site-config/site-path";
import { redirect } from "next/navigation";

export default async function OverviewTemplate() {
  // Dentro de una tienda el destino tiene que conservar el prefijo: un redirect a
  // la ruta limpia deja la URL fuera del sitio (el avatar del header caía en
  // /account/orders y el menú no marcaba el ítem activo). Bajo subdominios el
  // prefijo es '' y esto se vuelve un no-op solo.
  redirect(withSitePrefix("/account/orders", await getActiveSitePrefix()));
}
