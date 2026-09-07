import { sdk } from "../../../lib/sdk";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get("_medusa_jwt")?.value;
}

// POST /api/store/loyalty/redeem — redeem a reward. Body: { reward_id }.
export async function POST(request: Request) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ success: false, message: "No autenticado" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const rewardId = body?.reward_id;
    if (!rewardId || typeof rewardId !== "string") {
      return NextResponse.json({ success: false, message: "reward_id requerido" }, { status: 400 });
    }
    const result = await sdk.client.fetch<{ grant?: unknown; already?: boolean }>(
      "/store/loyalty/redeem",
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: { reward_id: rewardId },
      },
    );
    return NextResponse.json({ success: true, grant: result.grant, already: result.already ?? false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al canjear la recompensa";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
