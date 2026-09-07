import { sdk } from "../../../lib/sdk";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get("_medusa_jwt")?.value;
}

// GET /api/store/loyalty/rewards — redeemable rewards for the active program.
export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ success: false, message: "No autenticado" }, { status: 401 });
  }
  try {
    const result = await sdk.client.fetch<{ rewards?: unknown[]; points_name?: string }>(
      "/store/loyalty/rewards",
      { method: "GET", headers: { authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    return NextResponse.json({
      success: true,
      rewards: result.rewards ?? [],
      points_name: result.points_name ?? "puntos",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al obtener recompensas";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
