import { retrieveOrder } from "@lib/data/orders";
import OrderCompletedTemplate from "@modules/order/templates/order-completed-template";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};
export const metadata: Metadata = {
  title: "Órden confirmada",
  description: "Su orden ha sido confirmada",
};

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  // Omitir verificación de sales_channel para la página de confirmación
  // porque el usuario acaba de crear la orden y debe poder verla inmediatamente
  const order = await retrieveOrder(params.id, true).catch(() => null);

  if (!order) {
    return notFound();
  }

  // `celebrated=1` lo ponen las pantallas de retorno de MercadoPago
  // (/checkout/success y /checkout/pending), que YA mostraron el overlay
  // animado mientras esperaban al webhook. Sin esto la misma animación —y su
  // sonido— se reproducen dos veces seguidas al redirigir acá.
  const celebrated = searchParams.celebrated === "1";

  return <OrderCompletedTemplate celebrated={celebrated} order={order} />;
}
