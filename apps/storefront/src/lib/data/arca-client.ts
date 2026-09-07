/**
 * Wrapper de cliente para el lookup de ARCA (constancia de inscripción).
 * Le pega al route handler /api (excluido del rewrite del proxy, mismo patrón
 * que billing-profile-client.ts).
 */

export type ArcaTaxpayer = {
  cuit: string;
  legal_name: string;
  tax_condition:
    | "responsable_inscripto"
    | "exento"
    | "monotributo"
    | "consumidor_final";
  status: string;
  address: {
    address_line_1: string;
    city: string;
    province: string;
    postal_code: string;
    country_code: string;
  };
  source: "arca";
  verified_at: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const FALLBACK_ERROR =
  "No pudimos consultar ARCA en este momento. Completá los datos a mano.";

export async function lookupArcaTaxpayer(
  cuit: string,
): Promise<Result<ArcaTaxpayer>> {
  try {
    const res = await fetch("/api/store/arca/taxpayer-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cuit: cuit.replace(/\D/g, "") }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      taxpayer?: ArcaTaxpayer;
      message?: string;
    };
    if (!res.ok || !data.taxpayer) {
      return { ok: false, error: data.message || FALLBACK_ERROR };
    }
    return { ok: true, data: data.taxpayer };
  } catch {
    return { ok: false, error: FALLBACK_ERROR };
  }
}
