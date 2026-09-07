import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";

  try {
    const res = await fetch(
      `${BACKEND_URL}/store/barcode-scanner/lookup?code=${encodeURIComponent(code)}`,
      {
        headers: PUBLISHABLE_KEY
          ? { "x-publishable-api-key": PUBLISHABLE_KEY }
          : {},
        cache: "no-store",
      },
    );

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.warn("[BARCODE-SCANNER] Lookup proxy error:", error);
    return NextResponse.json(
      { message: "No se pudo buscar el producto escaneado" },
      { status: 500 },
    );
  }
}
