// Use CommonJS require to avoid ES module issues with @medusajs/js-sdk

import type { Product } from "types/global";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: Medusa } = require("@medusajs/js-sdk");

const NEXT_PUBLIC_MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

// Validate environment variables in development
if (process.env.NODE_ENV === "development") {
  if (!process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL) {
    console.warn(
      "NEXT_PUBLIC_MEDUSA_BACKEND_URL environment variable is not set, using default"
    );
  }
  if (!process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY) {
    console.warn(
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY environment variable is not set"
    );
  }
}

// Admin API key should only be used server-side
const getAdminApiKey = () => {
  if (typeof window !== "undefined") {
    throw new Error("Admin API key cannot be accessed on client side");
  }
  return process.env.MEDUSA_ADMIN_API_KEY || "";
};

// Create Medusa client for store API (public product access)
// MedusaJS v2 requires publishable key as a header
export const medusaClient = new Medusa({
  baseUrl: NEXT_PUBLIC_MEDUSA_BACKEND_URL,
  publishableKey: MEDUSA_PUBLISHABLE_KEY,
  // The SDK should automatically add the x-publishable-api-key header
});

// Create Medusa client for admin API (product management) - server-side only
export const getMedusaAdminClient = () =>
  new Medusa({
    baseUrl: NEXT_PUBLIC_MEDUSA_BACKEND_URL,
    apiKey: getAdminApiKey(),
  });

// MedusaJS product type structure
interface MedusaProduct {
  id: string;
  title: string;
  subtitle?: string | null;
  description: string | null;
  handle: string;
  status: "draft" | "published" | "proposed" | "rejected";
  external_id?: string | null;
  is_giftcard: boolean;
  discountable: boolean;
  thumbnail?: string | null;
  collection_id?: string | null;
  type_id?: string | null;
  weight?: number | null;
  length?: number | null;
  height?: number | null;
  width?: number | null;
  hs_code?: string | null;
  origin_country?: string | null;
  mid_code?: string | null;
  material?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  variants?: MedusaVariant[];
  options?: MedusaProductOption[];
  tags?: MedusaTag[];
  images?: MedusaImage[];
  categories?: MedusaCategory[];
  sales_channels?: MedusaSalesChannel[];
  type?: MedusaProductType | null;
  collection?: MedusaCollection | null;
}

interface MedusaProductOption {
  id: string;
  title: string;
  metadata?: Record<string, any> | null;
  product_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  values?: MedusaOptionValue[];
}

interface MedusaOptionValue {
  id: string;
  value: string;
  metadata?: Record<string, any> | null;
  option_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface MedusaTag {
  id: string;
  value: string;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface MedusaImage {
  id: string;
  url: string;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface MedusaCategory {
  id: string;
  name: string;
  description?: string | null;
  handle: string;
  is_active: boolean;
  is_internal: boolean;
  parent_category_id?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface MedusaSalesChannel {
  id: string;
  name: string;
  description?: string | null;
  is_disabled: boolean;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface MedusaProductType {
  id: string;
  value: string;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface MedusaCollection {
  id: string;
  title: string;
  handle: string;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface MedusaVariant {
  id: string;
  title: string;
  sku: string | null;
  inventory_quantity?: number;
  manage_inventory?: boolean;
  prices?: MedusaPrice[];
  // Nueva estructura después de la migración de Medusa v2
  calculated_price?: {
    id: string;
    is_calculated_price_price_list: boolean;
    is_calculated_price_tax_inclusive: boolean;
    calculated_amount: number;
    raw_calculated_amount: Record<string, unknown>;
    is_original_price_price_list: boolean;
    is_original_price_tax_inclusive: boolean;
    original_amount: number;
    raw_original_amount: Record<string, unknown>;
    currency_code: string;
    calculated_price: Record<string, unknown>;
    original_price: Record<string, unknown>;
  };
  inventory?: Array<{
    location_levels?: Array<{
      stocked_quantity: number;
      reserved_quantity: number;
      incoming_quantity: number;
    }>;
  }>;
  // Inventory items for Medusa v2
  inventory_items?: Array<{
    id: string;
    location_levels?: Array<{
      location_id: string;
      stocked_quantity: number;
      reserved_quantity: number;
      incoming_quantity: number;
      available_quantity?: number;
    }>;
  }>;
}

interface MedusaPrice {
  amount: number;
  currency_code: string;
}

// Transform MedusaJS product to our frontend format
export function transformMedusaProduct(medusaProduct: MedusaProduct): Product {
  const firstVariant: MedusaVariant | undefined = medusaProduct.variants?.[0];

  return {
    id: medusaProduct.id,
    name: medusaProduct.title || "Untitled Product",
    description: medusaProduct.description,
    price: (() => {
      if (!firstVariant) {
        console.warn(
          `⚠️ No variant found for product ${medusaProduct.title} (${medusaProduct.id})`
        );
        return 0;
      }

      // Prioridad 1: Usar calculated_price si está disponible (nueva estructura v2)
      if (firstVariant.calculated_price?.calculated_amount) {
        const calculatedPrice = firstVariant.calculated_price.calculated_amount;

        return calculatedPrice;
      }

      // Prioridad 2: Fallback a prices array (estructura legacy)
      if (firstVariant.prices && firstVariant.prices.length > 0) {
        // Try to find ARS price first, then fallback to first price
        const arsPrice = firstVariant.prices.find(
          (p: MedusaPrice) => p.currency_code === "ars"
        );
        const price = arsPrice || firstVariant.prices[0];

        return price?.amount || 0;
      }

      return 0;
    })(),
    sku: firstVariant?.sku || medusaProduct.handle || null,
    stock_quantity: (() => {
      if (!firstVariant) return 0;

      // Prioridad 1: Usar nueva estructura de inventario si está disponible
      if (firstVariant.inventory && firstVariant.inventory.length > 0) {
        const locationLevels = firstVariant.inventory[0].location_levels;
        if (locationLevels && locationLevels.length > 0) {
          const totalStock = locationLevels.reduce(
            (total: number, level: { stocked_quantity: number; reserved_quantity: number }) =>
              total + (level.stocked_quantity - level.reserved_quantity),
            0
          );
          return Math.max(0, totalStock); // No permitir stock negativo
        }
      }

      // Prioridad 2: Fallback a inventory_quantity legacy
      if (firstVariant.inventory_quantity !== undefined) {
        return firstVariant.inventory_quantity;
      }

      // Prioridad 3: Si manage_inventory está deshabilitado, usar stock ilimitado
      return firstVariant.manage_inventory ? 0 : 999;
    })(),
    is_active: (() => {
      const metadataActive = medusaProduct.metadata?.is_active;
      const statusActive = medusaProduct.status === "published";
      const finalActive = metadataActive ?? statusActive;

      return finalActive;
    })(),
    created_at: medusaProduct.created_at,
    updated_at: medusaProduct.updated_at,
    created_by: null, // MedusaJS doesn't have this field by default
    creator: null, // MedusaJS doesn't have this field by default

    // Extended Medusa fields
    handle: medusaProduct.handle,
    status: medusaProduct.status,
    subtitle: medusaProduct.subtitle,
    thumbnail: medusaProduct.thumbnail,
    metadata: medusaProduct.metadata,
    is_giftcard: medusaProduct.is_giftcard,
    discountable: medusaProduct.discountable,
    weight: medusaProduct.weight,
    length: medusaProduct.length,
    height: medusaProduct.height,
    width: medusaProduct.width,
    sales_channels: medusaProduct.sales_channels?.map((sc) => ({
      id: sc.id,
      name: sc.name,
      description: sc.description,
      is_disabled: sc.is_disabled,
    })),
    tags: medusaProduct.tags?.map((tag) => ({
      id: tag.id,
      value: tag.value,
    })),
    variants: medusaProduct.variants?.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      prices: variant.prices,
      calculated_price: variant.calculated_price,
      inventory_items: variant.inventory_items,
      inventory_quantity: variant.inventory_quantity,
      manage_inventory: variant.manage_inventory,
      inventory: variant.inventory,
    })),
    images: medusaProduct.images?.map((img) => ({
      id: img.id,
      url: img.url,
    })),
    categories: medusaProduct.categories?.map((cat) => ({
      id: cat.id,
      name: cat.name,
      handle: cat.handle,
    })),
  };
}

// Product service functions
export class MedusaProductService {
  // Get all products with optional location filter
  static async getProducts(options?: {
    locationId?: string;
    salesChannelId?: string;
  }) {
    try {
      // Fetch all products with higher limit to get all 686 products
      const { products } = await medusaClient.store.product.list({
        limit: 1000, // Increased from 100 to 1000 to handle all products
        fields:
          "*variants.calculated_price,*variants.inventory_items.inventory_item_id,*sales_channels,*tags,*images,*categories,*options.values",
        // Include inventory_items with inventory_item_id to map with location-specific stock
      });

      let transformedProducts = (products as MedusaProduct[]).map(
        transformMedusaProduct
      );

      // If location filter is specified, filter products by stock in that location
      if (options?.locationId) {
        // Get inventory levels for the specific location
        const inventoryMap =
          await MedusaProductService.getInventoryLevelsForLocation(
            options.locationId
          );

        transformedProducts = transformedProducts.map((product) => {
          // Update stock quantity based on specific location
          const locationStock = MedusaProductService.getStockForLocation(
            product,
            options.locationId!,
            inventoryMap
          );

          return {
            ...product,
            stock_quantity: locationStock,
            _location_filtered: true,
            _location_id: options.locationId,
          };
        });
      } else {
        // When no specific location is selected, show total stock across all locations
        // Get inventory levels for ALL locations of this sales channel and sum them up
        const allLocationsInventoryMap =
          await MedusaProductService.getAllLocationsInventoryMap(
            options?.salesChannelId
          );

        transformedProducts = transformedProducts.map((product) => {
          // Calculate total stock from all variants using all-locations inventory map
          const totalStock = MedusaProductService.getTotalStockAllLocations(
            product,
            allLocationsInventoryMap
          );

          return {
            ...product,
            stock_quantity: totalStock,
            _location_filtered: false,
            _location_id: undefined,
          };
        });
      }

      return transformedProducts;
    } catch (error) {
      console.error("Error fetching products from MedusaJS:", error);
      console.error("MedusaJS client config at error:", {
        baseUrl: NEXT_PUBLIC_MEDUSA_BACKEND_URL,
        publishableKey: MEDUSA_PUBLISHABLE_KEY
          ? `${MEDUSA_PUBLISHABLE_KEY.substring(0, 10)}...`
          : "NOT SET",
        envVar: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
          ? "SET"
          : "NOT SET",
      });
      throw new Error("Failed to fetch products");
    }
  }

  // Helper method to get inventory levels for specific location using Admin API
  private static async getInventoryLevelsForLocation(
    locationId: string
  ): Promise<Map<string, number>> {
    try {
      const medusaAdminClient = getMedusaAdminClient();
      const inventoryMap = new Map<string, number>();

      // Get all inventory items with location levels
      const { inventory_items } =
        await medusaAdminClient.admin.inventoryItem.list({
          limit: 1000, // Get all inventory items
          fields: "id,*location_levels",
        });

      // Process each inventory item
      inventory_items?.forEach((inventoryItem: any) => {
        if (
          inventoryItem.location_levels &&
          inventoryItem.location_levels.length > 0
        ) {
          // Find the location level for our specific location
          const locationLevel = inventoryItem.location_levels.find(
            (level: any) => level.location_id === locationId
          );

          if (locationLevel) {
            // Use available_quantity directly from Medusa (already calculated)
            const availableQuantity = locationLevel.available_quantity || 0;

            inventoryMap.set(inventoryItem.id, availableQuantity);
          }
        }
      });

      return inventoryMap;
    } catch (error) {
      console.warn(
        "⚠️ Error fetching inventory levels for location:",
        locationId,
        error
      );
      return new Map();
    }
  }

  // Helper method to get inventory levels for ALL locations of a sales channel and sum them up
  private static async getAllLocationsInventoryMap(
    salesChannelId?: string
  ): Promise<Map<string, number>> {
    try {
      const medusaAdminClient = getMedusaAdminClient();
      const inventoryMap = new Map<string, number>();

      // First, get all locations associated with the sales channel
      let salesChannelLocationIds: string[] = [];

      if (salesChannelId) {
        const { stock_locations } =
          await medusaAdminClient.admin.stockLocation.list({
            sales_channel_id: [salesChannelId],
            limit: 100,
          });

        salesChannelLocationIds = stock_locations.map(
          (location: any) => location.id
        );
      }

      // Get all inventory items with all location levels
      const { inventory_items } =
        await medusaAdminClient.admin.inventoryItem.list({
          limit: 1000,
          fields: "id,*location_levels",
        });

      // Process each inventory item and sum stock only from sales channel locations
      inventory_items?.forEach((inventoryItem: any) => {
        let totalStockSalesChannelLocations = 0;

        // Sum available_quantity only from locations that belong to the sales channel
        if (
          inventoryItem.location_levels &&
          inventoryItem.location_levels.length > 0
        ) {
          inventoryItem.location_levels.forEach((locationLevel: any) => {
            const availableQuantity = locationLevel.available_quantity || 0;

            // If salesChannelId is specified, only include locations from that sales channel
            if (
              !salesChannelId ||
              salesChannelLocationIds.includes(locationLevel.location_id)
            ) {
              totalStockSalesChannelLocations += availableQuantity;
            }
          });
        }

        // Store the total stock across sales channel locations for this inventory item
        inventoryMap.set(inventoryItem.id, totalStockSalesChannelLocations);
      });

      return inventoryMap;
    } catch (error) {
      console.error(
        "❌ Error fetching inventory levels for sales channel locations:",
        error
      );
      return new Map();
    }
  }

  // Helper method to get total stock across all locations using inventory map
  private static getTotalStockAllLocations(
    product: Product,
    allLocationsInventoryMap: Map<string, number>
  ): number {
    try {
      let totalStock = 0;

      // Sum up stock from all variants using the all-locations inventory map
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach((variant: any) => {
          if (variant.inventory_items && variant.inventory_items.length > 0) {
            variant.inventory_items.forEach((inventoryItem: any) => {
              const actualInventoryItemId =
                inventoryItem.inventory_item_id || inventoryItem.id;
              const stock =
                allLocationsInventoryMap.get(actualInventoryItemId) || 0;
              totalStock += stock;
            });
          }
        });
      }

      // If no stock found from inventory items, use product stock_quantity as fallback
      if (totalStock === 0) {
        totalStock = product.stock_quantity || 0;
      }

      return totalStock;
    } catch (error) {
      console.error(
        "❌ Error calculating total stock for product:",
        product.name,
        error
      );
      return product.stock_quantity || 0;
    }
  }

  // Helper method to get stock for a specific location using inventory map
  private static getStockForLocation(
    product: Product,
    locationId: string,
    inventoryMap: Map<string, number>
  ): number {
    try {
      let totalStock = 0;

      // If product has variants, sum up stock from all variants
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach((variant: any, variantIndex: number) => {
          // Check if variant has inventory items
          if (variant.inventory_items && variant.inventory_items.length > 0) {
            variant.inventory_items.forEach((inventoryItem: any) => {
              // The inventoryItem here is a ProductVariantInventoryItem (pvitem_)
              // We need to get the actual inventory_item_id to match with our map
              const actualInventoryItemId =
                inventoryItem.inventory_item_id || inventoryItem.id;
              const stock = inventoryMap.get(actualInventoryItemId) || 0;
              totalStock += stock;
            });
          }
        });
      }

      if (totalStock > 0) {
        return totalStock;
      }

      // Fallback to general stock quantity
      const generalStock = product.stock_quantity || 0;
      return generalStock;
    } catch (error) {
      console.warn(
        "⚠️ Error calculating location stock for product:",
        product.id,
        error
      );
      return product.stock_quantity || 0;
    }
  }

  // Get single product
  static async getProduct(id: string, opts?: { salesChannelId?: string }) {
    try {
      const salesChannelId =
        opts?.salesChannelId || process.env.DEFAULT_SALES_CHANNEL_ID;
      const { product } = await medusaClient.store.product.retrieve(id, {
        fields:
          "id,title,description,handle,status,created_at,updated_at,variants.id,variants.title,variants.sku,variants.inventory_quantity,variants.prices.amount,variants.prices.currency_code",
        // Medusa v2 requires a single sales_channel_id to compute availability/prices in store API
        // If not provided via opts, we fallback to DEFAULT_SALES_CHANNEL_ID
        sales_channel_id: salesChannelId,
      });

      return transformMedusaProduct(product as MedusaProduct);
    } catch (error) {
      console.error("Error fetching product from MedusaJS:", error);
      throw new Error("Failed to fetch product");
    }
  }

  // Create product (admin only)
  static async createProduct(productData: {
    name: string;
    description?: string;
    price: number;
    sku?: string;
    stock_quantity?: number;
  }) {
    try {
      const adminClient = getMedusaAdminClient();
      const { product } = await adminClient.admin.product.create({
        title: productData.name,
        description: productData.description || "",
        handle:
          productData.sku ||
          productData.name.toLowerCase().replace(/\s+/g, "-"),
        status: "published" as const,
        options: [
          {
            title: "Default Option",
            values: ["Default"],
          },
        ],
        variants: [
          {
            title: "Default Variant",
            sku: productData.sku || undefined,
            prices: [
              {
                currency_code: "eur",
                amount: productData.price,
              },
            ],
          },
        ],
      });

      return transformMedusaProduct(product as MedusaProduct);
    } catch (error) {
      console.error("Error creating product in MedusaJS:", error);
      throw new Error("Failed to create product");
    }
  }

  // Update product (admin only)
  static async updateProduct(
    id: string,
    productData: {
      name?: string;
      description?: string;
      price?: number;
      sku?: string;
      stock_quantity?: number;
      is_active?: boolean;
    }
  ) {
    try {
      const adminClient = getMedusaAdminClient();

      // Prepare update data
      const updateData: any = {};

      if (productData.name !== undefined) updateData.title = productData.name;
      if (productData.description !== undefined)
        updateData.description = productData.description;
      if (productData.sku !== undefined || productData.name !== undefined) {
        updateData.handle =
          productData.sku ||
          productData.name?.toLowerCase().replace(/\s+/g, "-");
      }

      // Handle is_active field in metadata - get current product via Admin API to preserve metadata
      if (productData.is_active !== undefined) {
        // Get current product with metadata using Admin API
        const { product: currentProduct } =
          await adminClient.admin.product.retrieve(id);

        updateData.metadata = {
          ...(currentProduct.metadata || {}),
          is_active: productData.is_active,
        };
      }

      // Always keep status as published for visibility in admin
      updateData.status = "published";

      const { product } = await adminClient.admin.product.update(
        id,
        updateData
      );

      // Update variant if price or stock changed
      if (product.variants && product.variants.length > 0) {
        const variant = product.variants[0];

        const updateData: {
          sku?: string;
          prices?: Array<{
            currency_code: string;
            amount: number;
          }>;
        } = {};

        if (productData.sku !== undefined) updateData.sku = productData.sku;
        if (productData.price !== undefined) {
          updateData.prices = [
            {
              currency_code: "eur",
              amount: productData.price,
            },
          ];
        }
        // Note: inventory_quantity might need to be handled through inventory management API

        if (Object.keys(updateData).length > 0) {
          await adminClient.admin.product.updateVariant(
            id,
            variant.id,
            updateData
          );
        }
      }

      return transformMedusaProduct(product as MedusaProduct);
    } catch (error) {
      console.error("Error updating product in MedusaJS:", error);
      throw new Error("Failed to update product");
    }
  }

  // Delete product (admin only)
  static async deleteProduct(id: string) {
    try {
      const adminClient = getMedusaAdminClient();
      await adminClient.admin.product.delete(id);

      return { success: true };
    } catch (error) {
      console.error("Error deleting product from MedusaJS:", error);
      throw new Error("Failed to delete product");
    }
  }

  // Get sales channel by distributor name
  static async getSalesChannelByDistributor(distributorName: string) {
    try {
      const adminClient = getMedusaAdminClient();
      const { sales_channels } = await adminClient.admin.salesChannel.list({
        name: distributorName,
      });

      return sales_channels?.[0] || null;
    } catch (error) {
      console.error("Error fetching sales channel:", error);
      throw new Error("Failed to fetch sales channel");
    }
  }

  // Add product to sales channel
  static async addProductToSalesChannel(
    productId: string,
    salesChannelId: string
  ) {
    try {
      const adminClient = getMedusaAdminClient();
      await adminClient.admin.salesChannel.addProducts(salesChannelId, {
        product_ids: [productId],
      });

      return { success: true };
    } catch (error) {
      console.error("Error adding product to sales channel:", error);
      throw new Error("Failed to add product to sales channel");
    }
  }

  // Remove product from sales channel
  static async removeProductFromSalesChannel(
    productId: string,
    salesChannelId: string
  ) {
    try {
      const adminClient = getMedusaAdminClient();
      await adminClient.admin.salesChannel.removeProducts(salesChannelId, {
        product_ids: [productId],
      });

      return { success: true };
    } catch (error) {
      console.error("Error removing product from sales channel:", error);
      throw new Error("Failed to remove product from sales channel");
    }
  }
}
