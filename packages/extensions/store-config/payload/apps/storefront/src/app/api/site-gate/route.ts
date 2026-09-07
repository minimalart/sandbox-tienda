/**
 * Route Handler — desbloqueo de la página de contraseña (site gate)
 *
 * POST /api/site-gate   body: { scope: "store" | "site:{slug}", code: string }
 *
 * Manda la palabra al backend, que es el único que la conoce. Si acierta, guarda
 * el token que devuelve en la cookie `_site_gate` (httpOnly) y el layout de
 * `[countryCode]` deja pasar. La cookie NO se puede fabricar a mano: el layout
 * revalida el token contra el backend en cada request.
 *
 * Vive fuera de `[countryCode]` a propósito, así el gate no se bloquea a sí mismo
 * (el proxy además hace early-return en /api).
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";

const COOKIE_NAME = "_site_gate";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 horas

const SCOPE_RE = /^(store|(?:site|demo):[a-z0-9]+(?:-[a-z0-9]+)*)$/;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { scope?: string; code?: string };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request" }, { status: 400 });
  }

  const scope = body.scope ?? "";
  const code = body.code ?? "";

  if (!SCOPE_RE.test(scope) || !code.trim()) {
    return NextResponse.json({ ok: false, message: "Datos incompletos" }, { status: 422 });
  }

  try {
    const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
    const backendRes = await fetch(`${BACKEND_URL}/store/store-config/site-gate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(pk ? { "x-publishable-api-key": pk } : {}),
      },
      body: JSON.stringify({ scope, password: code.trim() }),
      cache: "no-store",
    });

    if (backendRes.status === 401) {
      return NextResponse.json({ ok: false, message: "Contraseña incorrecta" }, { status: 401 });
    }

    if (!backendRes.ok) {
      return NextResponse.json(
        { ok: false, message: "No pudimos validar el acceso" },
        { status: 502 },
      );
    }

    const data = (await backendRes.json()) as { ok?: boolean; token?: string };
    if (!data?.ok) {
      return NextResponse.json({ ok: false, message: "Contraseña incorrecta" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    // Sin token el gate está apagado: no hay nada que recordar.
    if (data.token) {
      res.cookies.set(COOKIE_NAME, data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: COOKIE_MAX_AGE,
      });
    }
    return res;
  } catch (error) {
    console.error("[SiteGate] Error verificando la contraseña:", error);
    return NextResponse.json(
      { ok: false, message: "No pudimos validar el acceso" },
      { status: 502 },
    );
  }
}
