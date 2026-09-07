import { sdk } from "../../../lib/sdk";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get("_medusa_jwt")?.value;
}

// GET /api/store/loyalty/grants — the customer's obtained reward benefits.
export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ success: false, message: "No autenticado" }, { status: 401 });
  }
  try {
    const result = await sdk.client.fetch<{ grants?: unknown[] }>("/store/loyalty/grants", {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return NextResponse.json({ success: true, grants: result.grants ?? [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al obtener canjes";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
