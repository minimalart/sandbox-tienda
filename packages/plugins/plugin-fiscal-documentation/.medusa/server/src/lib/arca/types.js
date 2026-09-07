"use strict";
/**
 * Integración ARCA (ex AFIP) — consulta de constancia de inscripción.
 *
 * Carpeta de funciones self-contained (sin modelos DB ni registro de módulo
 * Medusa), siguiendo el patrón de catalogador/ai/openrouter.ts. El único
 * consumidor es la ruta /store/arca/taxpayer-lookup.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArcaUnavailableError = exports.ArcaNotFoundError = exports.ArcaInvalidCuitError = exports.ArcaConfigError = exports.ARCA_URLS = void 0;
exports.ARCA_URLS = {
    production: {
        wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
        padron: 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5',
    },
    homologacion: {
        wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
        padron: 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5',
    },
};
/** Falta configuración (env ARCA_*) → 503 hacia el cliente. */
class ArcaConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ArcaConfigError';
    }
}
exports.ArcaConfigError = ArcaConfigError;
/** CUIT con formato/verificador inválido → 400. */
class ArcaInvalidCuitError extends Error {
    constructor(message = 'CUIT inválido (revisá los 11 dígitos y el verificador).') {
        super(message);
        this.name = 'ArcaInvalidCuitError';
    }
}
exports.ArcaInvalidCuitError = ArcaInvalidCuitError;
/** La persona no existe en el padrón → 404. */
class ArcaNotFoundError extends Error {
    constructor(message = 'No encontramos ese CUIT en ARCA.') {
        super(message);
        this.name = 'ArcaNotFoundError';
    }
}
exports.ArcaNotFoundError = ArcaNotFoundError;
/** ARCA caído / timeout / fault inesperado → 503 (el checkout sigue manual). */
class ArcaUnavailableError extends Error {
    constructor(message = 'No pudimos consultar ARCA en este momento.') {
        super(message);
        this.name = 'ArcaUnavailableError';
    }
}
exports.ArcaUnavailableError = ArcaUnavailableError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2FyY2EvdHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBNENVLFFBQUEsU0FBUyxHQUE4RDtJQUNsRixVQUFVLEVBQUU7UUFDVixJQUFJLEVBQUUsK0NBQStDO1FBQ3JELE1BQU0sRUFBRSxnRUFBZ0U7S0FDekU7SUFDRCxZQUFZLEVBQUU7UUFDWixJQUFJLEVBQUUsbURBQW1EO1FBQ3pELE1BQU0sRUFBRSxvRUFBb0U7S0FDN0U7Q0FDRixDQUFDO0FBRUYsK0RBQStEO0FBQy9ELE1BQWEsZUFBZ0IsU0FBUSxLQUFLO0lBQ3hDLFlBQVksT0FBZTtRQUN6QixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsSUFBSSxHQUFHLGlCQUFpQixDQUFDO0lBQ2hDLENBQUM7Q0FDRjtBQUxELDBDQUtDO0FBRUQsbURBQW1EO0FBQ25ELE1BQWEsb0JBQXFCLFNBQVEsS0FBSztJQUM3QyxZQUFZLE9BQU8sR0FBRyx5REFBeUQ7UUFDN0UsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLElBQUksR0FBRyxzQkFBc0IsQ0FBQztJQUNyQyxDQUFDO0NBQ0Y7QUFMRCxvREFLQztBQUVELCtDQUErQztBQUMvQyxNQUFhLGlCQUFrQixTQUFRLEtBQUs7SUFDMUMsWUFBWSxPQUFPLEdBQUcsa0NBQWtDO1FBQ3RELEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNmLElBQUksQ0FBQyxJQUFJLEdBQUcsbUJBQW1CLENBQUM7SUFDbEMsQ0FBQztDQUNGO0FBTEQsOENBS0M7QUFFRCxnRkFBZ0Y7QUFDaEYsTUFBYSxvQkFBcUIsU0FBUSxLQUFLO0lBQzdDLFlBQVksT0FBTyxHQUFHLDRDQUE0QztRQUNoRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsSUFBSSxHQUFHLHNCQUFzQixDQUFDO0lBQ3JDLENBQUM7Q0FDRjtBQUxELG9EQUtDIn0=