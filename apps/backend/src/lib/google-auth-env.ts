/**
 * Gate del login con Google (provider `auth-google` del Auth module).
 *
 * Vive acá y no inline en `medusa-config.ts` por una razón concreta: el config no
 * se puede importar desde un test (importa el bridge de plugins y evalúa
 * `defineConfig`), así que un gate escrito ahí adentro es un gate que nadie puede
 * probar. Esto es lo que se gana al mudarlo.
 *
 * El provider exige clientId, clientSecret Y callbackUrl. Si falta cualquiera, su
 * loader tira `Google callbackUrl is required` — y como Auth es un módulo del
 * CORE, ese error NO degrada el login con Google: se lleva puesto el
 * `medusa start` entero (visto en producción el 2026-09-08 con
 * `GOOGLE_CLIENT_ID` seteado y `GOOGLE_CALLBACK_URL` vacío → "Loaders for module
 * Auth failed" → exit code 1, la tienda entera abajo).
 *
 * Por eso el gate mira las TRES variables y no sólo el clientId: con dos de tres,
 * un gate parcial no se queda apagado, PRENDE Y REVIENTA. Un gate parcial es peor
 * que no tener gate.
 */

export const GOOGLE_AUTH_ENV_VARS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
] as const;

export type GoogleAuthEnvVar = (typeof GOOGLE_AUTH_ENV_VARS)[number];

export type GoogleAuthEnvState = {
  /** Las tres variables presentes: el provider se puede registrar sin crashear. */
  enabled: boolean;
  /** Las que faltan, en el orden de `GOOGLE_AUTH_ENV_VARS`. */
  missing: GoogleAuthEnvVar[];
  /**
   * Alguien intentó configurar Google pero dejó el set incompleto. Es el caso que
   * hay que gritar: `enabled: false` con `partial: false` es simplemente una
   * tienda que no usa Google login, y esa no merece ni una línea de log.
   */
  partial: boolean;
};

/**
 * Una variable seteada en blanco es una variable ausente. No es un detalle
 * cosmético: los paneles de las PaaS (DigitalOcean App Platform, entre otras)
 * guardan la clave con string vacío cuando se la deja sin valor, así que el
 * `process.env.X` existe y un chequeo por `in` o por `!== undefined` la contaría
 * como configurada.
 */
export function resolveGoogleAuthEnv(
  source: Record<string, string | undefined> = process.env
): GoogleAuthEnvState {
  const missing = GOOGLE_AUTH_ENV_VARS.filter((key) => !source[key]?.trim());

  return {
    enabled: missing.length === 0,
    missing,
    partial: missing.length > 0 && missing.length < GOOGLE_AUTH_ENV_VARS.length,
  };
}

/**
 * Que el gate falle cerrado evita el crash, pero abre el OTRO modo de falla: el
 * botón "Continuar con Google" deja de funcionar y nada lo dice. Este aviso es la
 * mitad que falta del fix — sin él cambiamos un boot roto y ruidoso por un login
 * roto y callado, que se descubre cuando lo reporta un cliente.
 *
 * Devuelve el texto en vez de loguearlo para poder afirmarlo en un test.
 */
export function googleAuthEnvWarning(state: GoogleAuthEnvState): string | undefined {
  if (!state.partial) return undefined;

  return (
    '[auth-google] ⚠️  El login con Google queda APAGADO: falta ' +
    `${state.missing.join(', ')}. El provider las exige a las tres, así que ` +
    'registrarlo así abortaría el arranque del backend ("Loaders for module Auth ' +
    'failed: Google callbackUrl is required"). Completá las variables que faltan ' +
    'o borrá GOOGLE_CLIENT_ID para apagar Google a propósito. ' +
    'GOOGLE_CALLBACK_URL apunta a la página del STOREFRONT ' +
    '(https://tu-dominio/google-callback), no al backend.'
  );
}
