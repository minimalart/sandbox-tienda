import "server-only";
import { sdk } from "@lib/config";

export type StoreSettings = {
  multi_branch_enabled: boolean;
  require_branch_coverage: boolean;
  /**
   * ¿Se dibuja la barra del selector de zona (`BranchGate`)? Sub-flag de
   * `multi_branch_enabled` y el ÚNICO de este objeto cuyo default es `true`.
   */
  branch_gate_prompt_enabled: boolean;
  barcode_scanner_enabled: boolean;
  cookie_banner_enabled: boolean;
  /**
   * Página de contraseña de la tienda principal. `length` es el largo de la
   * palabra (cuántas casillas dibuja el formulario); la palabra en sí nunca
   * sale del backend.
   */
  password_gate: { enabled: boolean; length: number };
};

const DEFAULTS: StoreSettings = {
  multi_branch_enabled: false,
  require_branch_coverage: false,
  branch_gate_prompt_enabled: true,
  barcode_scanner_enabled: false,
  cookie_banner_enabled: false,
  password_gate: { enabled: false, length: 0 },
};

/**
 * Reads the store-wide toggles (managed in the admin "Preferencias" screen) from
 * the backend public endpoint. Server-side; safe defaults (multi-branch off) on
 * error so single-channel stores never break.
 */
export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    const data = await sdk.client.fetch<Partial<StoreSettings>>(
      "/store/store-config",
      { method: "GET" },
    );
    return {
      multi_branch_enabled: !!data?.multi_branch_enabled,
      require_branch_coverage: !!data?.require_branch_coverage,
      /**
       * `!== false` y NO `!!`, a diferencia de todos sus hermanos: el default es
       * `true`, así que la clave ausente tiene que leerse como PRENDIDA. Con `!!`
       * un backend viejo (o cualquier respuesta que no traiga la clave) apagaría
       * la barra sin que nadie la haya apagado.
       */
      branch_gate_prompt_enabled: data?.branch_gate_prompt_enabled !== false,
      barcode_scanner_enabled: !!data?.barcode_scanner_enabled,
      cookie_banner_enabled: !!data?.cookie_banner_enabled,
      password_gate: {
        enabled: !!data?.password_gate?.enabled,
        length: Number(data?.password_gate?.length) || 0,
      },
    };
  } catch {
    return DEFAULTS;
  }
}
