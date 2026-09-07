/**
 * /driver → redirige al listado de paradas (protegido)
 * El guard está en (authenticated)/layout.tsx
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DriverRootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("_driver_jwt")?.value;

  if (!token) {
    redirect("/driver/login");
  }

  redirect("/driver/stops");
}
