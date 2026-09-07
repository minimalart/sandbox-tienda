import { NextResponse } from "next/server";

/**
 * Proxy de la cotización tintométrica. El cliente nunca habla directo con el
 * backend: acá se agrega la publishable key y se hace passthrough de status +
 * body (el backend ya devuelve mensajes listos para la UI, incluido el 424
 * degradado cuando el ERP no contesta).
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}));

  try {
    const res = await fetch(`${BACKEND_URL}/store/tinting/quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(PUBLISHABLE_KEY ? { "x-publishable-api-key": PUBLISHABLE_KEY } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.warn("[tinting] quote proxy error:", error);
    return NextResponse.json(
      {
        message: "No pudimos calcular el precio del color en este momento.",
        degraded: true,
      },
      { status: 424 },
    );
  }
}
