import { sdk } from "../../lib/sdk";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get("_medusa_jwt")?.value;
}

type PointsTransaction = {
  id: string;
  amount: number;
  type: string;
  reference: string | null;
  reference_id: string | null;
  created_at: string;
};

// GET /api/store/points — the authenticated customer's balance + ledger.
export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json(
      { success: false, message: "No autenticado" },
      { status: 401 },
    );
  }

  const headers = { authorization: `Bearer ${token}` };

  try {
    const result = await sdk.client.fetch<{
      points?: { balance?: number; transactions?: PointsTransaction[] };
    }>("/store/points", {
      method: "GET",
      headers,
      cache: "no-store",
    });

    return NextResponse.json({
      success: true,
      points: {
        balance: result.points?.balance ?? 0,
        transactions: result.points?.transactions ?? [],
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error al obtener puntos";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

// POST /api/store/points — redeem points. Body: { action: "redeem", amount }.
export async function POST(request: Request) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json(
      { success: false, message: "No autenticado" },
      { status: 401 },
    );
  }

  const headers = { authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  try {
    const body = await request.json();
    const { action, amount } = body;

    if (action !== "redeem") {
      return NextResponse.json(
        { success: false, message: "Acción inválida" },
        { status: 400 },
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "amount debe ser un número positivo" },
        { status: 400 },
      );
    }

    const result = await sdk.client.fetch<{ balance?: number; redeemed?: number }>(
      "/store/points/redeem",
      {
        method: "POST",
        headers,
        body: { amount },
      },
    );

    return NextResponse.json({
      success: true,
      balance: result.balance ?? 0,
      redeemed: result.redeemed ?? amount,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error al canjear puntos";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
