import { sdk } from "../../../lib/sdk";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get("_medusa_jwt")?.value;
}

// GET /api/store/loyalty/tier — the customer's current tier + progress.
export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ success: false, message: "No autenticado" }, { status: 401 });
  }
  try {
    const result = await sdk.client.fetch<{
      tier?: unknown;
      next?: unknown;
      toNext?: number;
      metrics?: unknown;
    }>("/store/loyalty/tier", {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return NextResponse.json({
      success: true,
      tier: result.tier ?? null,
      next: result.next ?? null,
      toNext: result.toNext ?? 0,
      metrics: result.metrics ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al obtener el nivel";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
