"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSnapshot = buildSnapshot;
exports.hashSnapshot = hashSnapshot;
exports.diffSnapshots = diffSnapshots;
const node_crypto_1 = require("node:crypto");
/**
 * Construye el snapshot persistible a partir de la respuesta normalizada de ARCA.
 * Guarda todo lo que sale del lookup para poder reconstruir el estado exacto.
 */
function buildSnapshot(taxpayer) {
    return {
        tax_id: taxpayer.cuit,
        legal_name: taxpayer.legal_name,
        tax_condition: taxpayer.tax_condition,
        status: taxpayer.status,
        address: {
            address_line_1: taxpayer.address.address_line_1,
            city: taxpayer.address.city,
            province: taxpayer.address.province,
            postal_code: taxpayer.address.postal_code,
            country_code: taxpayer.address.country_code,
        },
        activities: [],
        source: 'arca',
        verified_at: taxpayer.verified_at,
    };
}
/**
 * Stringify determinístico (claves ordenadas) para que el hash sea estable
 * independientemente del orden de las propiedades.
 */
function stableStringify(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(stableStringify).join(',')}]`;
    const keys = Object.keys(value).sort();
    const body = keys
        .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
        .join(',');
    return `{${body}}`;
}
/**
 * Hash sha256 del contenido fiscal del snapshot. Excluye `verified_at` a
 * propósito: dos consultas idénticas hechas en momentos distintos deben producir
 * el mismo hash (así el diff detecta cambios de DATOS, no de timestamp).
 */
function hashSnapshot(snapshot) {
    const { verified_at: _ignored, ...fiscal } = snapshot;
    return (0, node_crypto_1.createHash)('sha256').update(stableStringify(fiscal)).digest('hex');
}
/** Campos comparados y su etiqueta legible (orden de presentación). */
const DIFF_FIELDS = [
    { field: 'legal_name', label: 'Razón social', get: (s) => s.legal_name },
    { field: 'tax_condition', label: 'Condición IVA', get: (s) => s.tax_condition },
    { field: 'status', label: 'Estado', get: (s) => s.status },
    { field: 'address_line_1', label: 'Domicilio', get: (s) => s.address.address_line_1 },
    { field: 'city', label: 'Localidad', get: (s) => s.address.city },
    { field: 'province', label: 'Provincia', get: (s) => s.address.province },
    { field: 'postal_code', label: 'Código postal', get: (s) => s.address.postal_code },
    { field: 'activities', label: 'Actividades', get: (s) => s.activities.join(', ') },
];
/**
 * Compara dos snapshots y devuelve solo los campos que cambiaron
 * (`before` = versión anterior, `after` = versión nueva).
 */
function diffSnapshots(before, after) {
    const changes = [];
    for (const { field, label, get } of DIFF_FIELDS) {
        const b = get(before) ?? '';
        const a = get(after) ?? '';
        if (b !== a) {
            changes.push({ field, label, before: b || null, after: a || null });
        }
    }
    return changes;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic25hcHNob3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9maXNjYWwtZG9jdW1lbnRhdGlvbi9zbmFwc2hvdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVFBLHNDQWlCQztBQXFCRCxvQ0FHQztBQWtCRCxzQ0FVQztBQTdFRCw2Q0FBeUM7QUFJekM7OztHQUdHO0FBQ0gsU0FBZ0IsYUFBYSxDQUFDLFFBQTRCO0lBQ3hELE9BQU87UUFDTCxNQUFNLEVBQUUsUUFBUSxDQUFDLElBQUk7UUFDckIsVUFBVSxFQUFFLFFBQVEsQ0FBQyxVQUFVO1FBQy9CLGFBQWEsRUFBRSxRQUFRLENBQUMsYUFBYTtRQUNyQyxNQUFNLEVBQUUsUUFBUSxDQUFDLE1BQU07UUFDdkIsT0FBTyxFQUFFO1lBQ1AsY0FBYyxFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsY0FBYztZQUMvQyxJQUFJLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJO1lBQzNCLFFBQVEsRUFBRSxRQUFRLENBQUMsT0FBTyxDQUFDLFFBQVE7WUFDbkMsV0FBVyxFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsV0FBVztZQUN6QyxZQUFZLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxZQUFZO1NBQzVDO1FBQ0QsVUFBVSxFQUFFLEVBQUU7UUFDZCxNQUFNLEVBQUUsTUFBTTtRQUNkLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVztLQUNsQyxDQUFDO0FBQ0osQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQVMsZUFBZSxDQUFDLEtBQWM7SUFDckMsSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVE7UUFBRSxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDOUUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztRQUFFLE9BQU8sSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO0lBQzdFLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBZ0MsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2xFLE1BQU0sSUFBSSxHQUFHLElBQUk7U0FDZCxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxlQUFlLENBQUUsS0FBaUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7U0FDNUYsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2IsT0FBTyxJQUFJLElBQUksR0FBRyxDQUFDO0FBQ3JCLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsU0FBZ0IsWUFBWSxDQUFDLFFBQXdCO0lBQ25ELE1BQU0sRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLEdBQUcsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDO0lBQ3RELE9BQU8sSUFBQSx3QkFBVSxFQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDNUUsQ0FBQztBQUVELHVFQUF1RTtBQUN2RSxNQUFNLFdBQVcsR0FBZ0Y7SUFDL0YsRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFO0lBQ3hFLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBRSxLQUFLLEVBQUUsZUFBZSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLGFBQWEsRUFBRTtJQUMvRSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUU7SUFDMUQsRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFO0lBQ3JGLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7SUFDakUsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRTtJQUN6RSxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFO0lBQ25GLEVBQUUsS0FBSyxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsYUFBYSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7Q0FDbkYsQ0FBQztBQUVGOzs7R0FHRztBQUNILFNBQWdCLGFBQWEsQ0FBQyxNQUFzQixFQUFFLEtBQXFCO0lBQ3pFLE1BQU0sT0FBTyxHQUFzQixFQUFFLENBQUM7SUFDdEMsS0FBSyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsSUFBSSxXQUFXLEVBQUUsQ0FBQztRQUNoRCxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQzVCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDM0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDWixPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsQ0FBQyxJQUFJLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUM7UUFDdEUsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDIn0=