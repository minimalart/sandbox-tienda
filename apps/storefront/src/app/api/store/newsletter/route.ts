import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `newsletter:${ip}`;
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
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
 * Alta al newsletter. Proxy al backend de Medusa
 * (`POST /store/newsletter-subscriptions`), que persiste el contacto y lo
 * sincroniza con Brevo usando la API key y la lista de ESTA tienda.
 *
 * ─── QUÉ HABÍA ACÁ ANTES ────────────────────────────────────────────────────
 *
 * Un `console.log` y un `{ success: true }` fijo, con un TODO. El formulario
 * mostraba "¡Te suscribiste correctamente!" y no había ninguna integración
 * detrás — ni con Brevo ni con nada. El síntoma reportado ("el contacto no llega
 * a la lista") era el comportamiento completo del endpoint, no una falla suya.
 *
 * ─── POR QUÉ EL PROXY Y NO LLAMAR A BREVO DESDE ACÁ ─────────────────────────
 *
 * Porque la API key es de un CLIENTE, no del deploy. En el backend vive en
 * `site_credential` cifrada, se edita desde el admin y se resuelve por tienda;
 * acá tendría que ser una env var de Vercel: no editable sin redeploy, una sola
 * para todas las tiendas que sirva este storefront, y visible para cualquiera
 * que pueda leer la configuración del proyecto.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const rateLimitCheck = checkRateLimit(ip);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Demasiados intentos. Probá de nuevo en ${rateLimitCheck.retryAfter} segundos.`,
        },
        { status: 429 },
      );
    }

    const { email } = (await request.json()) as { email?: unknown };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
    }

    if (!MEDUSA_PUBLISHABLE_KEY) {
      // Sin la key no hay tienda que resolver y el backend no sabría a qué cuenta
      // de Brevo mandar el contacto. Se falla ruidoso en vez de devolver el
      // `success: true` de antes, que es lo que escondió el problema durante meses.
      console.error("[Newsletter] Falta NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY");
      return NextResponse.json(
        { error: "Error de configuración del servidor." },
        { status: 500 },
      );
    }

    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/newsletter-subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        email,
        source: "storefront",
        metadata: { user_agent: request.headers.get("user-agent") ?? null },
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      return NextResponse.json(
        { error: err.message ?? "No se pudo completar la suscripción." },
        { status: res.status },
      );
    }

    /**
     * El backend responde 201 aunque Brevo haya fallado: el contacto ya quedó
     * guardado y el visitante SÍ se suscribió. `sync_status` viaja para que el
     * problema quede en los logs de este lado también — no se le muestra al
     * visitante, que no tiene nada que hacer con esa información ni forma de
     * arreglarla.
     */
    const data = (await res.json().catch(() => ({}))) as {
      newsletter_subscription?: { sync_status?: string };
    };
    const syncStatus = data.newsletter_subscription?.sync_status;
    if (syncStatus && syncStatus !== "synced") {
      console.warn(`[Newsletter] Alta guardada pero sin sincronizar (${syncStatus}).`);
    }

    return NextResponse.json({ success: true, message: "Subscribed successfully!" });
  } catch (error) {
    console.error("[Newsletter] Error:", error);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
