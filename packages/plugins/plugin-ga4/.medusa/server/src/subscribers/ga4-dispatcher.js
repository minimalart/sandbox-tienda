"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = ga4DispatcherHandler;
const utils_1 = require("@medusajs/framework/utils");
const ga4_1 = require("../modules/ga4");
const supported_events_1 = require("../modules/ga4/lib/supported-events");
/**
 * Despacha eventos GENÉRICOS (mapeos medusa_event → ga4_event definidos por el
 * usuario) a GA4 server-side vía Measurement Protocol. Los eventos del embudo
 * ecommerce los maneja ga4-ecommerce-dispatcher.ts. Si faltan las credenciales
 * hace no-op; nunca lanza (cualquier fallo se loguea).
 */
async function ga4DispatcherHandler({ event, container, }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    try {
        // Igual que dynamic-groups.ts: el nombre del evento disparado vive en
        // event.name; los datos en event.data.
        const eventName = event.name;
        const ga4Service = container.resolve(ga4_1.GA4_MODULE);
        // No-op cuando el tracking server-side no está configurado (config en DB).
        if (!(await ga4Service.isConfigured())) {
            return;
        }
        const mappings = await ga4Service.listActiveMappings(eventName);
        for (const mapping of mappings) {
            await ga4Service.dispatch(mapping, event.data);
        }
    }
    catch (error) {
        logger.warn(`[GA4] No se pudo despachar evento (${event.name}): ${error.message}`);
    }
}
exports.config = {
    event: supported_events_1.SUPPORTED_EVENT_NAMES,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2E0LWRpc3BhdGNoZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc3Vic2NyaWJlcnMvZ2E0LWRpc3BhdGNoZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBYUEsdUNBNEJDO0FBeENELHFEQUFzRTtBQUV0RSx3Q0FBNEM7QUFFNUMsMEVBQTRFO0FBRTVFOzs7OztHQUtHO0FBQ1ksS0FBSyxVQUFVLG9CQUFvQixDQUFDLEVBQ2pELEtBQUssRUFDTCxTQUFTLEdBQ3NCO0lBQy9CLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQVMsaUNBQXlCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFM0UsSUFBSSxDQUFDO1FBQ0gsc0VBQXNFO1FBQ3RFLHVDQUF1QztRQUN2QyxNQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1FBRTdCLE1BQU0sVUFBVSxHQUFxQixTQUFTLENBQUMsT0FBTyxDQUFDLGdCQUFVLENBQUMsQ0FBQztRQUVuRSwyRUFBMkU7UUFDM0UsSUFBSSxDQUFDLENBQUMsTUFBTSxVQUFVLENBQUMsWUFBWSxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQ3ZDLE9BQU87UUFDVCxDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsTUFBTSxVQUFVLENBQUMsa0JBQWtCLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFaEUsS0FBSyxNQUFNLE9BQU8sSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUMvQixNQUFNLFVBQVUsQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqRCxDQUFDO0lBQ0gsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixNQUFNLENBQUMsSUFBSSxDQUNULHNDQUFzQyxLQUFLLENBQUMsSUFBSSxNQUFPLEtBQWUsQ0FBQyxPQUFPLEVBQUUsQ0FDakYsQ0FBQztJQUNKLENBQUM7QUFDSCxDQUFDO0FBRVksUUFBQSxNQUFNLEdBQXFCO0lBQ3RDLEtBQUssRUFBRSx3Q0FBcUI7Q0FDN0IsQ0FBQyJ9