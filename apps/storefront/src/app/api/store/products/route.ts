import { listProducts } from "@lib/repositories/products.repository";
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const countryCode = searchParams.get("countryCode");
  const page = Number(searchParams.get("page")) || 1;
  const sortBy = (searchParams.get("sortBy") as SortOptions) || "created_at";
  const limit = Number(searchParams.get("limit")) || 12;
  const collectionId = searchParams.get("collectionId") ?? undefined;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const productIds = searchParams.getAll("productsIds");
  const searchQuery = searchParams.get("q") ?? undefined;
  const erpSubcategoryId = searchParams.get("erpSubcategoryId") ?? undefined;
  const inStock = searchParams.get("inStock") === "true" || undefined;

  if (!countryCode) {
    return NextResponse.json(
      { message: "countryCode is required" },
      { status: 400 },
    );
  }

  try {
    const result = await listProducts({
      page,
      limit,
      sortBy,
      countryCode,
      categoryId,
      collectionId,
      productIds: productIds.length > 0 ? productIds : undefined,
      searchQuery,
      erpSubcategoryId,
      inStock,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Failed to fetch products:", error);
    return NextResponse.json(
      { message: "Unable to fetch products" },
      { status: 500 },
    );
  }
}
