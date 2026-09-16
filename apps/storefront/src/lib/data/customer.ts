"use server";

import { sdk } from "@lib/config";
import { TENANT_MISMATCH_ERROR } from "@lib/constants/customer";
import { getActiveDemoSlug } from "@lib/site-config/active-tenant";
import { getActiveSitePrefix } from "@lib/site-config/active-tenant";
import { withSitePrefix } from "@lib/site-config/site-path";
import { getTenant } from "@lib/site-config/resolver";
import medusaError from "@lib/util/medusa-error";
import {
  CART_COMPLETED_AT_FIELD,
  isCompletedCart,
} from "@lib/util/completed-cart";
import type { HttpTypes } from "@medusajs/types";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeAuthToken,
  removeCartId,
  setAuthToken,
} from "./cookies";

/**
 * Helper para migrar metadata.tenant_id (string legacy) a metadata.tenant_ids (array)
 */
function migrateTenantIdToArray(
  metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!metadata) {
    return {};
  }

  // Si ya tiene tenant_ids como array, retornar sin cambios
  if (Array.isArray(metadata.tenant_ids)) {
    return metadata;
  }

  // Si tiene tenant_id como string, migrar a array
  if (typeof metadata.tenant_id === "string" && metadata.tenant_id) {
    const tenantIds = [metadata.tenant_id];
    const { tenant_id, ...rest } = metadata;
    return {
      ...rest,
      tenant_ids: tenantIds,
    };
  }

  // Si no tiene ninguno, retornar sin cambios
  return metadata;
}

/**
 * Obtiene los tenant_ids del customer (array) desde metadata, manejando migración automática
 */
function getCustomerTenantIds(
  metadata: Record<string, unknown> | null | undefined
): string[] {
  const migrated = migrateTenantIdToArray(metadata);
  if (Array.isArray(migrated.tenant_ids)) {
    return migrated.tenant_ids as string[];
  }
  return [];
}

export const retrieveCustomer =
  async (): Promise<HttpTypes.StoreCustomer | null> => {
    const authHeaders = await getAuthHeaders();

    if (!authHeaders || !authHeaders.authorization) {
      return null;
    }

    const headers = {
      ...authHeaders,
    };

    return await sdk.client
      .fetch<{ customer: HttpTypes.StoreCustomer }>("/store/customers/me", {
        method: "GET",
        query: {
          fields: "*orders,*addresses",
        },
        headers,
        cache: "no-store",
      })
      .then(async ({ customer }) => {
        // Aplicar migración automática si es necesario
        const metadata = customer.metadata as Record<string, unknown> | null | undefined;
        const migratedMetadata = migrateTenantIdToArray(metadata);
        
        // Si hubo migración, actualizar el customer
        if (JSON.stringify(metadata) !== JSON.stringify(migratedMetadata)) {
          try {
            await sdk.store.customer.update(
              { metadata: migratedMetadata },
              {},
              headers
            );
            // Actualizar el objeto customer con el nuevo metadata
            customer.metadata = migratedMetadata;
          } catch (error) {
            // Si falla la actualización, continuar con el customer original
            console.error("Error al migrar tenant_id:", error);
          }
        }
        
        return customer;
      })
      .catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[retrieveCustomer] Error al obtener el customer:", error);
        }
        return null;
      });
  };

/**
 * Sube (o reemplaza) la foto de perfil del customer autenticado.
 * Recibe el archivo en base64; el backend lo guarda con el File module y
 * persiste la URL en customer.metadata.avatar_url. Devuelve la URL nueva.
 */
export const uploadCustomerAvatar = async (
  filename: string,
  mimeType: string,
  content: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  const headers = {
    ...(await getAuthHeaders()),
  };

  try {
    const { url } = await sdk.client.fetch<{ url: string }>(
      "/store/customers/me/avatar",
      { method: "POST", headers, body: { filename, mimeType, content } }
    );
    const cacheTag = await getCacheTag("customers");
    revalidateTag(cacheTag, "max");
    return { success: true, url };
  } catch (error: any) {
    return { success: false, error: error?.message || "No se pudo subir la foto" };
  }
};

/** Quita la foto de perfil del customer autenticado (limpia metadata.avatar_url). */
export const deleteCustomerAvatar = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  const headers = {
    ...(await getAuthHeaders()),
  };

  try {
    await sdk.client.fetch("/store/customers/me/avatar", {
      method: "DELETE",
      headers,
    });
    const cacheTag = await getCacheTag("customers");
    revalidateTag(cacheTag, "max");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "No se pudo quitar la foto" };
  }
};

export const updateCustomer = async (body: HttpTypes.StoreUpdateCustomer) => {
  const headers = {
    ...(await getAuthHeaders()),
  };

  const updateRes = await sdk.store.customer
    .update(body, {}, headers)
    .then(({ customer }) => customer)
    .catch(medusaError);

  const cacheTag = await getCacheTag("customers");
  revalidateTag(cacheTag, 'max');

  return updateRes;
};

export async function signup(_currentState: unknown, formData: FormData) {
  const password = formData.get("password") as string;
  const customerForm = {
    email: formData.get("email") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: formData.get("phone") as string,
  };

  try {
    // Obtener tenant actual para vincular el customer
    const tenant = await getTenant();

    const token = await sdk.auth.register("customer", "emailpass", {
      email: customerForm.email,
      password,
    });

    await setAuthToken(token as string);

    const headers = {
      ...(await getAuthHeaders()),
    };

    // Crear customer con tenant_id en metadata
    const { customer: createdCustomer } = await sdk.store.customer.create(
      {
        ...customerForm,
        metadata: {
          tenant_id: tenant.id,
        },
      },
      {},
      headers
    );

    const loginToken = await sdk.auth.login("customer", "emailpass", {
      email: customerForm.email,
      password,
    });

    await setAuthToken(loginToken as string);

    const customerCacheTag = await getCacheTag("customers");
    revalidateTag(customerCacheTag, 'max');

    await transferCart();
    return createdCustomer;
  } catch (error: any) {
    return error.toString();
  }
}

export async function login(_currentState: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    await sdk.auth
      .login("customer", "emailpass", { email, password })
      .then(async (token) => {
        await setAuthToken(token as string);
        const customerCacheTag = await getCacheTag("customers");
        revalidateTag(customerCacheTag, 'max');
      });

    // Validar que el customer pertenezca al tenant actual
    const tenant = await getTenant();
    const customer = await retrieveCustomer();

    if (customer) {
      const metadata = customer.metadata as Record<string, unknown> | null | undefined;
      const tenantIds = getCustomerTenantIds(metadata);
      
      // Migrar si es necesario (tenant_id legacy)
      const migratedMetadata = migrateTenantIdToArray(metadata);
      if (JSON.stringify(metadata) !== JSON.stringify(migratedMetadata)) {
        await updateCustomer({ metadata: migratedMetadata });
        // Actualizar array después de migración
        tenantIds.push(...getCustomerTenantIds(migratedMetadata));
      }
      
      // Si el customer tiene tenant_ids y el tenant actual no está en el array, rechazar login
      if (tenantIds.length > 0 && !tenantIds.includes(tenant.id)) {
        await removeAuthToken();
        const originalTenant = tenantIds[0];
        return `${TENANT_MISMATCH_ERROR}:${originalTenant}`;
      }

      // Si el customer no tiene tenant_ids, agregar el tenant actual
      if (tenantIds.length === 0) {
        await updateCustomer({
          metadata: {
            ...migratedMetadata,
            tenant_ids: [tenant.id],
          },
        });
      }
    }
  } catch (error: any) {
    return error.toString();
  }

  try {
    await transferCart();
  } catch (error: any) {
    return error.toString();
  }
}

export async function signout(_countryCode?: string) {
  await sdk.auth.logout();

  await removeAuthToken();

  const customerCacheTag = await getCacheTag("customers");
  revalidateTag(customerCacheTag, 'max');

  await removeCartId();

  const cartCacheTag = await getCacheTag("carts");
  revalidateTag(cartCacheTag, 'max');

  // Dentro de un demo el destino conserva el prefijo /demo/{slug}: si no, el
  // logout deja al usuario en la tienda principal.
  redirect(withSitePrefix("/account", await getActiveSitePrefix()));
}

/**
 * ¿El carrito de la cookie ya se convirtió en orden?
 *
 * Fetch mínimo (`id,completed_at`) a propósito: es un guard, no una lectura del
 * carrito. Ante cualquier error devuelve `false` — "no sé" no es "sí".
 */
async function isCartAlreadyCompleted(
  cartId: string,
  headers: Record<string, string>,
): Promise<boolean> {
  try {
    const { cart } = await sdk.client.fetch<HttpTypes.StoreCartResponse>(
      `/store/carts/${cartId}`,
      {
        method: "GET",
        query: { fields: `id,${CART_COMPLETED_AT_FIELD}` },
        headers,
        cache: "no-store",
      },
    );
    return isCompletedCart(cart);
  } catch {
    return false;
  }
}

export async function transferCart() {
  const cartId = await getCartId();

  if (!cartId) {
    return;
  }

  const headers = await getAuthHeaders();

  // Un carrito que ya es orden no se transfiere: la cookie puede seguir
  // apuntando a la compra recién hecha (la orden la crea el webhook de
  // MercadoPago y la pantalla de éxito no siempre llega a limpiarla). Sin este
  // corte, loguearse volvía a enganchar el carrito comprado a la cuenta y sus
  // ítems reaparecían marcados "Sin stock", bloqueando la próxima compra
  // (DESDEELSUR-61 / BUG-08).
  //
  // Sólo se corta con una respuesta que CONFIRMA `completed_at`: si el fetch
  // falla no se asume nada y se intenta el transfer igual, porque cancelarlo por
  // un error de red dejaría el carrito legítimo colgado del invitado — el bug
  // que ya documenta `cart-customer-transfer.ts`.
  if (await isCartAlreadyCompleted(cartId, headers)) {
    return;
  }

  await sdk.store.cart.transferCart(cartId, {}, headers);

  const cartCacheTag = await getCacheTag("carts");
  revalidateTag(cartCacheTag, 'max');
}

export const addCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<{ success: boolean; error: string | null; isDefaultShipping?: boolean }> => {
  const isDefaultBilling = (currentState?.isDefaultBilling as boolean) || false;
  const isDefaultShipping = (currentState?.isDefaultShipping as boolean) || false;

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    phone: formData.get("phone") as string,
    is_default_billing: isDefaultBilling,
    is_default_shipping: isDefaultShipping,
  };

  const headers = {
    ...(await getAuthHeaders()),
  };

  try {
    await sdk.store.customer.createAddress(address, {}, headers);
    const customerCacheTag = await getCacheTag("customers");
    revalidateTag(customerCacheTag, 'max');
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || err?.toString() || "Error al guardar dirección" };
  }
};

export const deleteCustomerAddress = async (
  addressId: string
): Promise<void> => {
  const headers = {
    ...(await getAuthHeaders()),
  };

  await sdk.store.customer
    .deleteAddress(addressId, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers");
      revalidateTag(customerCacheTag, 'max');
      return { success: true, error: null };
    })
    .catch((err) => ({ success: false, error: err.toString() }));
};

export const updateCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const addressId =
    (currentState.addressId as string) || (formData.get("addressId") as string);

  if (!addressId) {
    return { success: false, error: "Address ID is required" };
  }

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
  } as HttpTypes.StoreUpdateCustomerAddress;

  const phone = formData.get("phone") as string;

  if (phone) {
    address.phone = phone;
  }

  const headers = {
    ...(await getAuthHeaders()),
  };

  return sdk.store.customer
    .updateAddress(addressId, address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers");
      revalidateTag(customerCacheTag, 'max');
      return { success: true, error: null };
    })
    .catch((err) => ({ success: false, error: err.toString() }));
};
