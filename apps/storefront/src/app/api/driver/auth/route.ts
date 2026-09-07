/**
 * Route Handler — autenticación del driver
 *
 * POST /api/driver/auth   body: { action: "login" | "logout", email?, password? }
 *
 * Login: llama a POST /auth/user/emailpass en el backend Medusa y setea la
 * cookie _driver_jwt (httpOnly, separada de _medusa_jwt del customer).
 *
 * La cookie es httpOnly para que no sea accesible desde JS en el browser.
 * El guard del layout del driver la lee server-side vía cookies() de Next.js.
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";

const COOKIE_NAME = "_driver_jwt";
const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 horas — sesión operativa

function setCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { action?: string; email?: string; password?: string };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "Bad request" }, { status: 400 });
  }

  const { action } = body;

  // ── Logout ────────────────────────────────────────────────────────────────
  if (action === "logout") {
    const res = NextResponse.json({ success: true });
    res.cookies.set(COOKIE_NAME, "", { ...setCookieOptions(-1) });
    return res;
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  if (action !== "login") {
    return NextResponse.json({ success: false, message: "Unknown action" }, { status: 400 });
  }

  const { email, password } = body;

  if (!email?.trim() || !password) {
    return NextResponse.json(
      { success: false, message: "Email y contraseña son requeridos" },
      { status: 422 },
    );
  }

  try {
    // Medusa v2: POST /auth/user/emailpass → { token }
    const medusaRes = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
      cache: "no-store",
    });

    if (medusaRes.status === 401 || medusaRes.status === 400) {
      return NextResponse.json(
        { success: false, message: "Credenciales incorrectas" },
        { status: 401 },
      );
    }

    if (!medusaRes.ok) {
      const err = await medusaRes.json().catch(() => ({})) as { message?: string };
      return NextResponse.json(
        { success: false, message: err.message ?? "Error del servidor" },
        { status: medusaRes.status },
      );
    }

    const data = (await medusaRes.json()) as { token?: string };
    const token = data.token;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "El servidor no devolvió un token" },
        { status: 500 },
      );
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(COOKIE_NAME, token, setCookieOptions(COOKIE_MAX_AGE));
    return res;
  } catch (err) {
    console.error("[driver/auth] Error:", err);
    return NextResponse.json(
      { success: false, message: "Error de conexión con el servidor" },
      { status: 503 },
    );
  }
}
