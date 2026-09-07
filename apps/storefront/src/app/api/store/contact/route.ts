import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getGaClientId } from "@lib/analytics/ga-client-id";

const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `contact:${ip}`;
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  return { allowed: true };
}

function getClientIp(request: NextRequest): string {
  const cfConnecting = request.headers.get("cf-connecting-ip");
  if (cfConnecting) return cfConnecting;
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

/**
 * Recibe el formulario de contacto del storefront y lo persiste en el backend
 * de Medusa (`/store/contact-submissions`), donde queda registrado para el
 * backoffice. Mantiene rate limiting por IP y un honeypot anti-bot.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || "unknown";

    const rateLimitCheck = checkRateLimit(ip);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Demasiados intentos. Intentá de nuevo en ${rateLimitCheck.retryAfter} segundos.`,
        },
        { status: 429 },
      );
    }

    const body = await request.json();

    // Honeypot anti-bot: si viene relleno, respondemos OK sin persistir.
    if (body?.honeypot) {
      return NextResponse.json({ success: true });
    }

    if (!MEDUSA_PUBLISHABLE_KEY) {
      console.error("Missing NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY");
      return NextResponse.json(
        { success: false, message: "Error de configuración del servidor." },
        { status: 500 },
      );
    }

    // GA client_id de la cookie _ga para atribuir el lead (generate_lead) a la
    // sesión de GA4 cuando el backend dispara el evento server-side.
    const gaClientId = await getGaClientId();

    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/contact-submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        first_name: String(body.first_name ?? ""),
        last_name: String(body.last_name ?? ""),
        email: String(body.email ?? ""),
        phone: body.phone ? String(body.phone) : null,
        message: String(body.message ?? ""),
        source: "storefront",
        metadata: {
          ip: ip !== "unknown" ? ip : null,
          user_agent: userAgent,
          ga_client_id: gaClientId,
        },
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      return NextResponse.json(
        { success: false, message: err.message ?? "No se pudo enviar el mensaje." },
        { status: res.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error in contact API:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error del servidor. Intentá nuevamente más tarde.",
      },
      { status: 500 },
    );
  }
}
