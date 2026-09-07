import type { HttpTypes } from "@medusajs/types";

type CustomerLike = Pick<
  HttpTypes.StoreCustomer,
  "first_name" | "last_name" | "email" | "metadata"
> | null | undefined;

// Datos de avatar derivados del customer: la URL vive en metadata.avatar_url
// y las iniciales caen a nombre/apellido, luego email, luego "?".
// Centralizado acá porque lo consumen account-layout y las 3 variantes del nav.
export function getCustomerAvatar(customer: CustomerLike): {
  avatarUrl?: string;
  initials: string;
} {
  const avatarUrl = (customer?.metadata as Record<string, unknown> | null)
    ?.avatar_url as string | undefined;

  const initials =
    `${customer?.first_name?.[0] ?? ""}${customer?.last_name?.[0] ?? ""}`.toUpperCase() ||
    customer?.email?.[0]?.toUpperCase() ||
    "?";

  return { avatarUrl, initials };
}
