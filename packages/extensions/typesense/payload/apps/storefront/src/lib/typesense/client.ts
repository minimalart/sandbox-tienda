import Typesense from "typesense";

const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.NEXT_PUBLIC_TYPESENSE_NODE_HOST || "localhost",
      port: Number(process.env.NEXT_PUBLIC_TYPESENSE_NODE_PORT) || 8109,
      protocol: process.env.NEXT_PUBLIC_TYPESENSE_NODE_PROTOCOL || "http",
    },
  ],
  apiKey: process.env.NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY || "",
  connectionTimeoutSeconds: 5,
});

export const TYPESENSE_COLLECTION_NAME: string =
  process.env.NEXT_PUBLIC_TYPESENSE_COLLECTION_NAME || "products";

export const TYPESENSE_SEARCH_PRESET: string | undefined =
  process.env.NEXT_PUBLIC_TYPESENSE_SEARCH_PRESET || undefined;

export default typesenseClient;
