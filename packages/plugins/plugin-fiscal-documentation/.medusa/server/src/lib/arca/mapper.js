"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapPersonaToTaxpayer = mapPersonaToTaxpayer;
/**
 * Normaliza la respuesta irregular del padrón al modelo del checkout.
 * Defensivo a propósito: nunca lanza por campo faltante, degrada a string
 * vacío (los campos quedan editables en el form).
 */
/** Impuestos del régimen general relevantes para la condición IVA. */
const IMPUESTO_IVA = '30';
const IMPUESTO_IVA_EXENTO = '32';
function asText(value) {
    if (value === null || value === undefined)
        return '';
    return String(value).trim();
}
function resolveTaxCondition(persona) {
    const mono = persona.datosMonotributo;
    if (mono && typeof mono === 'object' && Object.keys(mono).length > 0) {
        return 'monotributo';
    }
    const impuestos = (persona.datosRegimenGeneral?.impuesto ?? []).filter((imp) => {
        const estado = asText(imp?.estado).toUpperCase();
        return !estado || estado.startsWith('AC');
    });
    const ids = impuestos.map((imp) => asText(imp?.idImpuesto));
    if (ids.includes(IMPUESTO_IVA_EXENTO))
        return 'exento';
    if (ids.includes(IMPUESTO_IVA))
        return 'responsable_inscripto';
    return 'consumidor_final';
}
function mapPersonaToTaxpayer(persona, cuit) {
    const generales = persona.datosGenerales ?? {};
    const domicilio = generales.domicilioFiscal ?? {};
    const razonSocial = asText(generales.razonSocial);
    const nombreCompleto = [asText(generales.apellido), asText(generales.nombre)]
        .filter(Boolean)
        .join(' ');
    const provincia = asText(domicilio.descripcionProvincia);
    return {
        cuit,
        legal_name: razonSocial || nombreCompleto,
        tax_condition: resolveTaxCondition(persona),
        status: asText(generales.estadoClave),
        address: {
            address_line_1: asText(domicilio.direccion),
            // CABA viene sin localidad: cae a la provincia.
            city: asText(domicilio.localidad) || provincia,
            province: provincia,
            postal_code: asText(domicilio.codPostal),
            country_code: 'ar',
        },
        source: 'arca',
        verified_at: new Date().toISOString(),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFwcGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9hcmNhL21hcHBlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWlDQSxvREF3QkM7QUF0REQ7Ozs7R0FJRztBQUVILHNFQUFzRTtBQUN0RSxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUM7QUFDMUIsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUM7QUFFakMsU0FBUyxNQUFNLENBQUMsS0FBYztJQUM1QixJQUFJLEtBQUssS0FBSyxJQUFJLElBQUksS0FBSyxLQUFLLFNBQVM7UUFBRSxPQUFPLEVBQUUsQ0FBQztJQUNyRCxPQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUM5QixDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxPQUFzQjtJQUNqRCxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsZ0JBQWdCLENBQUM7SUFDdEMsSUFBSSxJQUFJLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQ3JFLE9BQU8sYUFBYSxDQUFDO0lBQ3ZCLENBQUM7SUFDRCxNQUFNLFNBQVMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsRUFBRSxRQUFRLElBQUksRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7UUFDN0UsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNqRCxPQUFPLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDNUMsQ0FBQyxDQUFDLENBQUM7SUFDSCxNQUFNLEdBQUcsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFDNUQsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDO1FBQUUsT0FBTyxRQUFRLENBQUM7SUFDdkQsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQztRQUFFLE9BQU8sdUJBQXVCLENBQUM7SUFDL0QsT0FBTyxrQkFBa0IsQ0FBQztBQUM1QixDQUFDO0FBRUQsU0FBZ0Isb0JBQW9CLENBQUMsT0FBc0IsRUFBRSxJQUFZO0lBQ3ZFLE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxjQUFjLElBQUksRUFBRSxDQUFDO0lBQy9DLE1BQU0sU0FBUyxHQUFHLFNBQVMsQ0FBQyxlQUFlLElBQUksRUFBRSxDQUFDO0lBQ2xELE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDbEQsTUFBTSxjQUFjLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDMUUsTUFBTSxDQUFDLE9BQU8sQ0FBQztTQUNmLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNiLE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUN6RCxPQUFPO1FBQ0wsSUFBSTtRQUNKLFVBQVUsRUFBRSxXQUFXLElBQUksY0FBYztRQUN6QyxhQUFhLEVBQUUsbUJBQW1CLENBQUMsT0FBTyxDQUFDO1FBQzNDLE1BQU0sRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQztRQUNyQyxPQUFPLEVBQUU7WUFDUCxjQUFjLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUM7WUFDM0MsZ0RBQWdEO1lBQ2hELElBQUksRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLFNBQVM7WUFDOUMsUUFBUSxFQUFFLFNBQVM7WUFDbkIsV0FBVyxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDO1lBQ3hDLFlBQVksRUFBRSxJQUFJO1NBQ25CO1FBQ0QsTUFBTSxFQUFFLE1BQU07UUFDZCxXQUFXLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUU7S0FDdEMsQ0FBQztBQUNKLENBQUMifQ==