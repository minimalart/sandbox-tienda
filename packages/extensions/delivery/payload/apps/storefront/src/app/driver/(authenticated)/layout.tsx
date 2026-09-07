/**
 * Layout de rutas autenticadas del driver.
 * Redirige a /driver/login si no hay cookie _driver_jwt.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AuthenticatedDriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("_driver_jwt")?.value;

  if (!token) {
    redirect("/driver/login");
  }

  return <>{children}</>;
}
