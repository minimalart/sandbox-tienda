/**
 * Configuración de la extensión Documentación Fiscal. Se persiste como setting
 * del módulo site-manager bajo el namespace `extension:fiscal-documentation`
 * (versionado, con historial/rollback) — no requiere modelo propio.
 */

export const FISCAL_CONFIG_NAMESPACE = 'extension:fiscal-documentation';

export type FiscalConfig = {
  /** Habilita la consulta a ARCA. Si está en false, la generación se rechaza. */
  arca_enabled: boolean;
  /** Genera y sube el PDF automáticamente al crear la versión. */
  auto_pdf: boolean;
  /** Actualiza razón social / CUIT + metadata fiscal de la empresa al consultar. */
  update_owner_data: boolean;
  /** Mantiene el historial completo. Si es false, solo conserva la vigente. */
  keep_history: boolean;
  /** Máximo de versiones a conservar (baja lógica del resto). null = sin límite. */
  max_versions: number | null;
  /** Marca institucional del encabezado del PDF. */
  pdf_brand_name: string;
  /** Pie institucional del PDF. */
  pdf_footer: string;
  /** URL del logo (PNG) para el encabezado del PDF. */
  logo_url: string | null;
};

export const DEFAULT_FISCAL_CONFIG: FiscalConfig = {
  arca_enabled: true,
  auto_pdf: true,
  update_owner_data: true,
  keep_history: true,
  max_versions: null,
  pdf_brand_name: 'Mercatto',
  pdf_footer:
    'Documento generado automáticamente a partir de información obtenida desde ARCA.',
  logo_url: null,
};

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Normaliza un valor crudo (del setting) a un FiscalConfig completo y saneado. */
export function normalizeFiscalConfig(raw: Record<string, unknown> | null | undefined): FiscalConfig {
  const r = raw ?? {};
  let maxVersions: number | null = DEFAULT_FISCAL_CONFIG.max_versions;
  if (r.max_versions === null) {
    maxVersions = null;
  } else if (typeof r.max_versions === 'number' && Number.isFinite(r.max_versions)) {
    maxVersions = Math.max(1, Math.floor(r.max_versions));
  }
  return {
    arca_enabled: asBool(r.arca_enabled, DEFAULT_FISCAL_CONFIG.arca_enabled),
    auto_pdf: asBool(r.auto_pdf, DEFAULT_FISCAL_CONFIG.auto_pdf),
    update_owner_data: asBool(r.update_owner_data, DEFAULT_FISCAL_CONFIG.update_owner_data),
    keep_history: asBool(r.keep_history, DEFAULT_FISCAL_CONFIG.keep_history),
    max_versions: maxVersions,
    pdf_brand_name:
      typeof r.pdf_brand_name === 'string' && r.pdf_brand_name.trim()
        ? r.pdf_brand_name.trim()
        : DEFAULT_FISCAL_CONFIG.pdf_brand_name,
    pdf_footer:
      typeof r.pdf_footer === 'string' && r.pdf_footer.trim()
        ? r.pdf_footer.trim()
        : DEFAULT_FISCAL_CONFIG.pdf_footer,
    logo_url: typeof r.logo_url === 'string' && r.logo_url.trim() ? r.logo_url.trim() : null,
  };
}
