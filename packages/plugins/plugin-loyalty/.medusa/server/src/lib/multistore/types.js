"use strict";
/**
 * Tipos del seam multitienda. Ver `EXTENSIONES-MULTITIENDA.md` en el root.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNKNOWN_SITE_ERROR_CODE = exports.shouldFilter = void 0;
/**
 * `singleSite` NO es lo mismo que `site`: con una sola tienda, filtrar por sus
 * canales igual escondería filas cuyo canal se creó a mano y no pertenece a
 * ninguna tienda. Con una sola tienda no hay nada que aislar, así que fail-open es
 * lo correcto.
 */
const shouldFilter = (resolution) => resolution.status === 'site';
exports.shouldFilter = shouldFilter;
/** Code estable para que el admin sepa limpiar su tienda persistida y volver a elegir. */
exports.UNKNOWN_SITE_ERROR_CODE = 'MULTISTORE_UNKNOWN_SITE';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL211bHRpc3RvcmUvdHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUE0REg7Ozs7O0dBS0c7QUFDSSxNQUFNLFlBQVksR0FBRyxDQUFDLFVBQTBCLEVBQW1ELEVBQUUsQ0FDMUcsVUFBVSxDQUFDLE1BQU0sS0FBSyxNQUFNLENBQUM7QUFEbEIsUUFBQSxZQUFZLGdCQUNNO0FBRS9CLDBGQUEwRjtBQUM3RSxRQUFBLHVCQUF1QixHQUFHLHlCQUF5QixDQUFDIn0=