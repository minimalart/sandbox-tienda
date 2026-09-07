import { NextResponse } from "next/server";

/**
 * Proxy del lookup de ARCA (constancia de inscripción). El cliente nunca habla
 * directo con el backend: acá se agrega la publishable key y se hace
 * passthrough de status + body (el backend ya devuelve mensajes para la UI).
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { cuit?: unknown };

  try {
    const res = await fetch(`${BACKEND_URL}/store/arca/taxpayer-lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(PUBLISHABLE_KEY ? { "x-publishable-api-key": PUBLISHABLE_KEY } : {}),
      },
      body: JSON.stringify({ cuit: String(body.cuit ?? "") }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.warn("[ARCA] Lookup proxy error:", error);
    return NextResponse.json(
      {
        message:
          "No pudimos consultar ARCA en este momento. Completá los datos a mano.",
      },
      { status: 503 },
    );
  }
}
