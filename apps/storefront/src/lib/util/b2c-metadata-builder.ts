import { retrieveCustomer } from "@lib/data/customer";
import { getTenant } from "@lib/site-config/resolver";
import type { HttpTypes } from "@medusajs/types";

/**
 * Construye metadata B2C para carritos y órdenes
 * Este metadata permite identificar y gestionar órdenes B2C desde el frontend B2B
 */
export async function buildB2CCartMetadata(
  cart?: HttpTypes.StoreCart
): Promise<Record<string, any>> {
  // Obtener tenant actual
  const tenant = await getTenant();
  
  // Obtener customer autenticado (puede ser null si es guest checkout)
  const customer = await retrieveCustomer().catch(() => null);

  // Metadata base para órdenes B2C
  const metadata: Record<string, any> = {
    b2cCart: true,
    order_type: "b2c_order",
    salesChannelId: tenant.medusa.salesChannelId,
    tenant_id: tenant.id,
    created_from: "b2c_storefront",
  };

  // Agregar información del customer si está autenticado
  if (customer) {
    metadata.customer_id = customer.id;
    metadata.customer_name = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.email;
    metadata.medusa_customer_id = customer.id;
  }

  // Si tenemos el carrito y tiene email, agregarlo también
  if (cart?.email) {
    metadata.customer_email = cart.email;
  }

  // Agregar payment_collection_id si el carrito ya lo tiene
  if (cart?.payment_collection?.id) {
    metadata.payment_collection_id = cart.payment_collection.id;
  }

  // Preservar metadata existente que no sea B2B
  if (cart?.metadata && typeof cart.metadata === "object") {
    const existingMetadata = cart.metadata as Record<string, any>;
    
    // Solo preservar metadata que no sea de B2B
    // No sobrescribir si ya tiene b2bCart o order_type de B2B
    if (!existingMetadata.b2bCart && existingMetadata.order_type !== "sales_order") {
      Object.assign(metadata, existingMetadata);
    }
  }

  return metadata;
}

/**
 * Verifica si un carrito ya tiene metadata B2C completo
 */
export function hasB2CMetadata(metadata: Record<string, any> | null | undefined): boolean {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  return (
    metadata.b2cCart === true &&
    metadata.order_type === "b2c_order" &&
    typeof metadata.salesChannelId === "string" &&
    typeof metadata.tenant_id === "string"
  );
}

/**
 * Verifica si un carrito tiene metadata B2B (no debe sobrescribirse)
 */
export function hasB2BMetadata(metadata: Record<string, any> | null | undefined): boolean {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  return (
    metadata.b2bCart === true ||
    metadata.order_type === "sales_order" ||
    metadata.created_from === "quotation_system"
  );
}

