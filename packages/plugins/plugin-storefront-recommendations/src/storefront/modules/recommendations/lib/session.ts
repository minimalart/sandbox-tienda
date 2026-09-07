'use client';

/**
 * Id de sesión anónima para atribuir recomendaciones.
 *
 * La cookie la escribe el proxy (`_rec_sid`), que es lo que garantiza que el rail
 * renderizado en el SERVIDOR y los beacons que dispara después el CLIENTE compartan la
 * misma sesión. Sin eso, el servidor no vería sesión alguna y el cliente inventaría
 * una distinta de la que produjo el `request_id`.
 *
 * Esta función es sólo la red de seguridad para cuando la cookie no está (primera
 * navegación con el proxy salteado, o un cliente que la borró): la crea del lado del
 * cliente para no perder el embudo.
 *
 * NO es httpOnly a propósito: el cliente tiene que poder leerla. No lleva ningún dato
 * personal, sólo un identificador aleatorio.
 */

export const REC_SESSION_COOKIE = '_rec_sid';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 días

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

const randomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback para contextos sin crypto (no debería pasar en un browser moderno).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/** Devuelve el id de sesión, creándolo si falta. Nunca lanza. */
export function ensureSessionId(): string | null {
  try {
    const existing = readCookie(REC_SESSION_COOKIE);
    if (existing) return existing;
    const created = randomId();
    document.cookie = `${REC_SESSION_COOKIE}=${encodeURIComponent(created)}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
    return created;
  } catch {
    // Cookies bloqueadas: se sigue sin sesión. Las recomendaciones funcionan igual,
    // sólo se pierde la capacidad de stitchear el embudo de ese visitante.
    return null;
  }
}
