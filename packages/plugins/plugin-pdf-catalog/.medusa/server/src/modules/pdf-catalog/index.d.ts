import PdfCatalogModuleService from './service';
export declare const PDF_CATALOG_MODULE = "pdf_catalog";
declare const _default: import("@medusajs/types").ModuleExports<typeof PdfCatalogModuleService> & {
    linkable: {
        readonly pdfCatalog: {
            id: {
                serviceName: "pdf_catalog";
                field: "pdfCatalog";
                linkable: "pdf_catalog_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "pdf_catalog";
                field: "pdfCatalog";
                linkable: "pdf_catalog_id";
                primaryKey: "id";
            };
        };
        readonly pdfCatalogHotspot: {
            id: {
                serviceName: "pdf_catalog";
                field: "pdfCatalogHotspot";
                linkable: "pdf_catalog_hotspot_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "pdf_catalog";
                field: "pdfCatalogHotspot";
                linkable: "pdf_catalog_hotspot_id";
                primaryKey: "id";
            };
        };
        readonly pdfCatalogChannel: {
            id: {
                serviceName: "pdf_catalog";
                field: "pdfCatalogChannel";
                linkable: "pdf_catalog_channel_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "pdf_catalog";
                field: "pdfCatalogChannel";
                linkable: "pdf_catalog_channel_id";
                primaryKey: "id";
            };
        };
    };
};
export default _default;
