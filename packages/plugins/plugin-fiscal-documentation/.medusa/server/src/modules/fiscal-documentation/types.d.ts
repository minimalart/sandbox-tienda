/**
 * Documentación Fiscal — módulo compartido que almacena constancias fiscales
 * (obtenidas de ARCA) y su historial de versiones, asociadas a una empresa
 * corporativa (`corporate`) o mayorista (`company`).
 *
 * El modelo es polimórfico (`owner_type` + `owner_id`) para poder ser reutilizado
 * por ambas extensiones y por integraciones futuras (facturación, ERP, agentes).
 * La obtención del dato viene de `modules/arca` (lookupTaxpayer); este módulo solo
 * persiste snapshots, genera el PDF y mantiene el historial/diff.
 */
export declare const FISCAL_DOCUMENTATION_MODULE = "fiscal_documentation";
/** A qué entidad pertenece la constancia. */
export type FiscalOwnerType = 'corporate' | 'company';
export declare const FISCAL_OWNER_TYPES: FiscalOwnerType[];
/** Tipo de documento. Por ahora solo constancia de inscripción; extensible. */
export type FiscalDocumentType = 'constancia';
/** De dónde salió el dato. */
export type FiscalDocumentSource = 'arca';
/**
 * Estado de la versión:
 * - `vigente`: la última consulta. Solo puede haber una por owner.
 * - `historica`: versiones anteriores (nunca se reemplazan, se archivan).
 */
export type FiscalDocumentStatus = 'vigente' | 'historica';
/**
 * Snapshot normalizado de la respuesta de ARCA. Guarda toda la información para
 * poder reconstruir exactamente qué sabía la empresa en ese momento y comparar
 * versiones. Estructuralmente alineado con `NormalizedTaxpayer` de `modules/arca`.
 */
export type FiscalSnapshot = {
    tax_id: string;
    legal_name: string;
    tax_condition: string;
    status: string;
    address: {
        address_line_1: string;
        city: string;
        province: string;
        postal_code: string;
        country_code: string;
    };
    /** Actividades declaradas. ARCA todavía no las expone por el lookup actual. */
    activities: string[];
    source: FiscalDocumentSource;
    /** ISO timestamp de la verificación en ARCA. */
    verified_at: string;
};
/** Una diferencia detectada entre dos snapshots. */
export type FiscalDiffEntry = {
    field: string;
    label: string;
    before: string | null;
    after: string | null;
};
/** Registro persistido (shape que devuelve el service/API). */
export type FiscalDocumentRecord = {
    id: string;
    owner_type: FiscalOwnerType;
    owner_id: string;
    type: FiscalDocumentType;
    status: FiscalDocumentStatus;
    source: FiscalDocumentSource;
    tax_id: string;
    file_id: string | null;
    file_url: string | null;
    snapshot: FiscalSnapshot;
    snapshot_hash: string;
    requested_by: string | null;
    generated_at: Date | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
};
