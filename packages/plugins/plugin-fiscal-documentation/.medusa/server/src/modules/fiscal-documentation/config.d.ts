/**
 * Configuración de la extensión Documentación Fiscal. Se persiste como setting
 * del módulo site-manager bajo el namespace `extension:fiscal-documentation`
 * (versionado, con historial/rollback) — no requiere modelo propio.
 */
export declare const FISCAL_CONFIG_NAMESPACE = "extension:fiscal-documentation";
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
export declare const DEFAULT_FISCAL_CONFIG: FiscalConfig;
/** Normaliza un valor crudo (del setting) a un FiscalConfig completo y saneado. */
export declare function normalizeFiscalConfig(raw: Record<string, unknown> | null | undefined): FiscalConfig;
