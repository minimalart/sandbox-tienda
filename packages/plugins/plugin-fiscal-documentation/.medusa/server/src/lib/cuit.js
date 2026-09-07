"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCuit = validateCuit;
/**
 * Validador de CUIT — vendorizado del host (`apps/backend/src/modules/billing-profile/types.ts`).
 *
 * `billing-profile` es un módulo AJENO al plugin (vive en el host) y el plugin
 * sólo necesita una función pura de validación (sin acceso al container ni a la
 * DB), así que se vendoriza acá para evitar acoplar el bundle del plugin al
 * árbol del host.
 *
 * Si el algoritmo cambia en el host, actualizar los dos lados —o promover esta
 * función a un paquete compartido tipo `@minimalart/mercatto-shared`.
 */
function validateCuit(cuit) {
    if (!cuit)
        return false;
    const clean = String(cuit).replace(/\D/g, '');
    if (clean.length !== 11)
        return false;
    const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += Number(clean[i]) * mult[i];
    }
    let check = 11 - (sum % 11);
    if (check === 11)
        check = 0;
    if (check === 10)
        return false; // CUIT inválido por convención
    return check === Number(clean[10]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3VpdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9saWIvY3VpdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVdBLG9DQWFDO0FBeEJEOzs7Ozs7Ozs7O0dBVUc7QUFDSCxTQUFnQixZQUFZLENBQUMsSUFBK0I7SUFDMUQsSUFBSSxDQUFDLElBQUk7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUN4QixNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUM5QyxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssRUFBRTtRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ3RDLE1BQU0sSUFBSSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDNUMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQ1osS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQzVCLEdBQUcsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBRSxDQUFDO0lBQ3JDLENBQUM7SUFDRCxJQUFJLEtBQUssR0FBRyxFQUFFLEdBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDNUIsSUFBSSxLQUFLLEtBQUssRUFBRTtRQUFFLEtBQUssR0FBRyxDQUFDLENBQUM7SUFDNUIsSUFBSSxLQUFLLEtBQUssRUFBRTtRQUFFLE9BQU8sS0FBSyxDQUFDLENBQUMsK0JBQStCO0lBQy9ELE9BQU8sS0FBSyxLQUFLLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNyQyxDQUFDIn0=