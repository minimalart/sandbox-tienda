"use strict";
/**
 * Configuración de la extensión Documentación Fiscal. Se persiste como setting
 * del módulo site-manager bajo el namespace `extension:fiscal-documentation`
 * (versionado, con historial/rollback) — no requiere modelo propio.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FISCAL_CONFIG = exports.FISCAL_CONFIG_NAMESPACE = void 0;
exports.normalizeFiscalConfig = normalizeFiscalConfig;
exports.FISCAL_CONFIG_NAMESPACE = 'extension:fiscal-documentation';
exports.DEFAULT_FISCAL_CONFIG = {
    arca_enabled: true,
    auto_pdf: true,
    update_owner_data: true,
    keep_history: true,
    max_versions: null,
    pdf_brand_name: 'Mercatto',
    pdf_footer: 'Documento generado automáticamente a partir de información obtenida desde ARCA.',
    logo_url: null,
};
function asBool(v, fallback) {
    return typeof v === 'boolean' ? v : fallback;
}
/** Normaliza un valor crudo (del setting) a un FiscalConfig completo y saneado. */
function normalizeFiscalConfig(raw) {
    const r = raw ?? {};
    let maxVersions = exports.DEFAULT_FISCAL_CONFIG.max_versions;
    if (r.max_versions === null) {
        maxVersions = null;
    }
    else if (typeof r.max_versions === 'number' && Number.isFinite(r.max_versions)) {
        maxVersions = Math.max(1, Math.floor(r.max_versions));
    }
    return {
        arca_enabled: asBool(r.arca_enabled, exports.DEFAULT_FISCAL_CONFIG.arca_enabled),
        auto_pdf: asBool(r.auto_pdf, exports.DEFAULT_FISCAL_CONFIG.auto_pdf),
        update_owner_data: asBool(r.update_owner_data, exports.DEFAULT_FISCAL_CONFIG.update_owner_data),
        keep_history: asBool(r.keep_history, exports.DEFAULT_FISCAL_CONFIG.keep_history),
        max_versions: maxVersions,
        pdf_brand_name: typeof r.pdf_brand_name === 'string' && r.pdf_brand_name.trim()
            ? r.pdf_brand_name.trim()
            : exports.DEFAULT_FISCAL_CONFIG.pdf_brand_name,
        pdf_footer: typeof r.pdf_footer === 'string' && r.pdf_footer.trim()
            ? r.pdf_footer.trim()
            : exports.DEFAULT_FISCAL_CONFIG.pdf_footer,
        logo_url: typeof r.logo_url === 'string' && r.logo_url.trim() ? r.logo_url.trim() : null,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvZmlzY2FsLWRvY3VtZW50YXRpb24vY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOzs7QUF3Q0gsc0RBd0JDO0FBOURZLFFBQUEsdUJBQXVCLEdBQUcsZ0NBQWdDLENBQUM7QUFxQjNELFFBQUEscUJBQXFCLEdBQWlCO0lBQ2pELFlBQVksRUFBRSxJQUFJO0lBQ2xCLFFBQVEsRUFBRSxJQUFJO0lBQ2QsaUJBQWlCLEVBQUUsSUFBSTtJQUN2QixZQUFZLEVBQUUsSUFBSTtJQUNsQixZQUFZLEVBQUUsSUFBSTtJQUNsQixjQUFjLEVBQUUsVUFBVTtJQUMxQixVQUFVLEVBQ1IsaUZBQWlGO0lBQ25GLFFBQVEsRUFBRSxJQUFJO0NBQ2YsQ0FBQztBQUVGLFNBQVMsTUFBTSxDQUFDLENBQVUsRUFBRSxRQUFpQjtJQUMzQyxPQUFPLE9BQU8sQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDL0MsQ0FBQztBQUVELG1GQUFtRjtBQUNuRixTQUFnQixxQkFBcUIsQ0FBQyxHQUErQztJQUNuRixNQUFNLENBQUMsR0FBRyxHQUFHLElBQUksRUFBRSxDQUFDO0lBQ3BCLElBQUksV0FBVyxHQUFrQiw2QkFBcUIsQ0FBQyxZQUFZLENBQUM7SUFDcEUsSUFBSSxDQUFDLENBQUMsWUFBWSxLQUFLLElBQUksRUFBRSxDQUFDO1FBQzVCLFdBQVcsR0FBRyxJQUFJLENBQUM7SUFDckIsQ0FBQztTQUFNLElBQUksT0FBTyxDQUFDLENBQUMsWUFBWSxLQUFLLFFBQVEsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1FBQ2pGLFdBQVcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFDRCxPQUFPO1FBQ0wsWUFBWSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsWUFBWSxFQUFFLDZCQUFxQixDQUFDLFlBQVksQ0FBQztRQUN4RSxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsNkJBQXFCLENBQUMsUUFBUSxDQUFDO1FBQzVELGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsaUJBQWlCLEVBQUUsNkJBQXFCLENBQUMsaUJBQWlCLENBQUM7UUFDdkYsWUFBWSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsWUFBWSxFQUFFLDZCQUFxQixDQUFDLFlBQVksQ0FBQztRQUN4RSxZQUFZLEVBQUUsV0FBVztRQUN6QixjQUFjLEVBQ1osT0FBTyxDQUFDLENBQUMsY0FBYyxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRTtZQUM3RCxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUU7WUFDekIsQ0FBQyxDQUFDLDZCQUFxQixDQUFDLGNBQWM7UUFDMUMsVUFBVSxFQUNSLE9BQU8sQ0FBQyxDQUFDLFVBQVUsS0FBSyxRQUFRLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUU7WUFDckQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFO1lBQ3JCLENBQUMsQ0FBQyw2QkFBcUIsQ0FBQyxVQUFVO1FBQ3RDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQyxRQUFRLEtBQUssUUFBUSxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUk7S0FDekYsQ0FBQztBQUNKLENBQUMifQ==