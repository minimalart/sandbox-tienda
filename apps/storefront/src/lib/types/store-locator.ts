export type StoreLocatorType =
  | "distribution_center"
  | "wholesale"
  | "point_of_sale";

export type StoreLocatorRegion =
  | "argentina"
  | "caba"
  | "buenos-aires"
  | "norte"
  | "centro"
  | "sur"
  | "uruguay";

export type StoreLocatorLocation = {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  country: string;
  lat: number | null;
  lng: number | null;
  type: StoreLocatorType;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  businessHoursSummary?: string;
  isOpenNow?: boolean;
  images?: string[] | null;
  socialMedia?: {
    instagram?: string | null;
    facebook?: string | null;
    website?: string | null;
    tiktok?: string | null;
    linkedin?: string | null;
  } | null;
};
