export type SalesChannel = "B2C" | "Wholesale" | "Presencial supermercado";

export type Product = {
  id: string;
  name: string;
  status: "published" | "draft";
  brand: string;
  source: string;
  priceArs: string;
  priceUsd?: string;
  sku: string;
  ean?: string;
  imageCount: number;
  variants?: {
    sizes: string[];
    colors: string[];
  };
  channels: SalesChannel[];
  metadata: string[];
  swatch: string;
};

export const products: Product[] = [
  {
    id: "remera-basica",
    name: "Remera Basica de Algodon",
    status: "published",
    brand: "Mercatto",
    source: "manual-catalog",
    priceArs: "ARS 8.500",
    priceUsd: "USD 9",
    sku: "REM-ALG-001",
    ean: "7798123001007",
    imageCount: 8,
    variants: {
      sizes: ["S", "M", "L", "XL"],
      colors: ["Negro", "Blanco"],
    },
    channels: ["B2C", "Wholesale", "Presencial supermercado"],
    metadata: ["brand: mercatto", "season: always-on", "margin: tracked"],
    swatch: "#e9edf5",
  },
  {
    id: "freidora-electrolux",
    name: "Freidora de aire Electrolux 3L",
    status: "published",
    brand: "Electrolux",
    source: "carrefour-vtex",
    priceArs: "ARS 85.499",
    sku: "CRF-ELX-AIR-3L",
    ean: "7909569482148",
    imageCount: 5,
    channels: ["B2C", "Wholesale"],
    metadata: ["source: carrefour-vtex", "category: kitchen", "sync: active"],
    swatch: "#0d1117",
  },
  {
    id: "smart-tv-tcl",
    name: "Smart TV 43 TCL QLED Google TV",
    status: "published",
    brand: "TCL",
    source: "carrefour-vtex",
    priceArs: "ARS 469.000",
    sku: "CRF-TCL-QLED-43",
    ean: "7796941324100",
    imageCount: 6,
    channels: ["B2C", "Presencial supermercado"],
    metadata: ["screen: 43", "source: retail import", "warranty: included"],
    swatch: "#181c27",
  },
  {
    id: "impresora-hp",
    name: "Impresora HP Smart Tank 210 WiFi",
    status: "published",
    brand: "HP",
    source: "supplier-feed",
    priceArs: "ARS 339.000",
    sku: "HP-ST-210-WIFI",
    ean: "0196786290103",
    imageCount: 4,
    channels: ["B2C", "Wholesale"],
    metadata: ["connectivity: wifi", "ink: smart tank", "feed: supplier"],
    swatch: "#f4f7fb",
  },
  {
    id: "aspiradora-liliana",
    name: "Aspiradora Liliana 2 en 1",
    status: "published",
    brand: "Liliana",
    source: "supplier-feed",
    priceArs: "ARS 111.186",
    sku: "LIL-ASP-2EN1",
    ean: "7798085682719",
    imageCount: 3,
    channels: ["B2C", "Presencial supermercado"],
    metadata: ["home: cleaning", "barcode: mapped", "stock: synced"],
    swatch: "#cfd7e6",
  },
];
