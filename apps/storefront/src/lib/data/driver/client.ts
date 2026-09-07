/**
 * Driver API client — storefront → backend
 *
 * Todas las llamadas van al backend de Medusa directamente desde el browser
 * usando el token del driver (Bearer). El token se lee de la cookie _driver_jwt
 * que seteó el Route Handler /api/driver/auth.
 *
 * Nota: no usamos el sdk de Medusa porque los endpoints /store/delivery/* son
 * custom y no están en el tipo del SDK. Seguimos el mismo patrón que
 * validar-entrega/page.tsx: fetch directo al BACKEND_URL con headers manuales.
 */

import type {
  DeliveryExecution,
  ExecutionActionPayload,
  ExecutionActionResponse,
  UploadProofResponse,
} from "./types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

// Lee el token de la cookie _driver_jwt (cliente)
function getDriverToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("_driver_jwt="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function buildHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-publishable-api-key": PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

// ── Paradas del driver ────────────────────────────────────────────────────────

export async function fetchDriverStops(): Promise<DeliveryExecution[]> {
  const token = getDriverToken();
  if (!token) throw new Error("NO_TOKEN");

  const res = await fetch(`${BACKEND_URL}/store/delivery/driver/me/stops`, {
    method: "GET",
    headers: buildHeaders(token),
    cache: "no-store",
  });

  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "FETCH_ERROR");
  }

  const data = (await res.json()) as { executions?: DeliveryExecution[] };
  return data.executions ?? [];
}

// ── Upload de evidencia (Proof of Delivery) ───────────────────────────────────

/**
 * Convierte un Blob a base64 y lo sube al endpoint de uploads del driver.
 * El backend almacena el archivo vía Modules.FILE y devuelve { url, id }.
 */
export async function uploadDriverProof(
  file: Blob,
  filename: string,
): Promise<UploadProofResponse> {
  const token = getDriverToken();
  if (!token) throw new Error("NO_TOKEN");

  // Convertir Blob → base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:image/png;base64,<data> → solo queremos <data>
      const comma = result.indexOf(",");
      resolve(comma !== -1 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("FILE_READ_ERROR"));
    reader.readAsDataURL(file);
  });

  const mimeType = file.type || "image/jpeg";

  const res = await fetch(`${BACKEND_URL}/store/delivery/driver/uploads`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify({ filename, mimeType, content: base64 }),
    cache: "no-store",
  });

  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "UPLOAD_ERROR");
  }

  return res.json() as Promise<UploadProofResponse>;
}

// ── Acción sobre una ejecución ────────────────────────────────────────────────

export async function postExecutionAction(
  executionId: string,
  payload: ExecutionActionPayload,
): Promise<DeliveryExecution> {
  const token = getDriverToken();
  if (!token) throw new Error("NO_TOKEN");

  const res = await fetch(
    `${BACKEND_URL}/store/delivery/driver/executions/${executionId}/action`,
    {
      method: "POST",
      headers: buildHeaders(token),
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "ACTION_ERROR");
  }

  const data = (await res.json()) as ExecutionActionResponse;
  return data.execution;
}
