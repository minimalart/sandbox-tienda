import type { StorePrice } from "@medusajs/types";

export type FeaturedProduct = {
  id: string;
  title: string;
  handle: string;
  thumbnail?: string;
};

export type VariantPrice = {
  calculated_price_number: number;
  calculated_price: string;
  original_price_number: number;
  original_price: string;
  currency_code: string;
  price_type: string;
  percentage_diff: string;
};

export type StoreFreeShippingPrice = StorePrice & {
  target_reached: boolean;
  target_remaining: number;
  remaining_percentage: number;
};
// MedusaJS-compatible Product type (replaces Supabase Product)
export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sku: string | null;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  creator: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  // Extended Medusa fields
  handle?: string;
  status?: "draft" | "published" | "proposed" | "rejected";
  subtitle?: string | null;
  thumbnail?: string | null;
  metadata?: Record<string, any> | null;
  is_giftcard?: boolean;
  discountable?: boolean;
  weight?: number | null;
  length?: number | null;
  height?: number | null;
  width?: number | null;
  sales_channels?: Array<{
    id: string;
    name: string;
    description?: string | null;
    is_disabled: boolean;
  }>;
  tags?: Array<{
    id: string;
    value: string;
  }>;
  images?: Array<{
    id: string;
    url: string;
  }>;
  categories?: Array<{
    id: string;
    name: string;
    handle: string;
  }>;
  variants?: Array<{
    id: string;
    title: string;
    sku: string | null;
    inventory_quantity?: number;
    inventory?: Array<{
      location_levels?: Array<{
        location_id?: string;
        stocked_quantity: number;
        reserved_quantity: number;
        incoming_quantity: number;
      }>;
    }>;
  }>;
  // Location filtering fields
  _location_filtered?: boolean;
  _location_id?: string;
};
