"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = dynamicGroupsSyncHandler;
const utils_1 = require("@medusajs/framework/utils");
const evaluate_customer_membership_1 = require("../workflows/evaluate-customer-membership");
/**
 * Tiempo real: ante una compra o un alta/actualización de cliente, reevalúa al
 * cliente afectado contra todos los grupos dinámicos activos y lo agrega/quita
 * de los customer_groups nativos al instante.
 */
async function dynamicGroupsSyncHandler({ event, container, }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    try {
        let customerId;
        if (event.name === 'order.placed') {
            const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
            const { data: orders } = await query.graph({
                entity: 'order',
                fields: ['id', 'customer_id'],
                filters: { id: event.data.id },
            });
            customerId = orders[0]?.customer_id ?? undefined;
        }
        else {
            // customer.created | customer.updated → el id es del cliente.
            customerId = event.data.id;
        }
        if (!customerId)
            return;
        await (0, evaluate_customer_membership_1.evaluateCustomerMembershipWorkflow)(container).run({
            input: { customer_id: customerId },
        });
    }
    catch (error) {
        logger.warn(`[DynamicGroups] No se pudo reevaluar membresía (${event.name}): ${error.message}`);
    }
}
exports.config = {
    event: ['order.placed', 'customer.created', 'customer.updated'],
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHluYW1pYy1ncm91cHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc3Vic2NyaWJlcnMvZHluYW1pYy1ncm91cHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBVUEsMkNBa0NDO0FBM0NELHFEQUFzRTtBQUV0RSw0RkFBK0Y7QUFFL0Y7Ozs7R0FJRztBQUNZLEtBQUssVUFBVSx3QkFBd0IsQ0FBQyxFQUNyRCxLQUFLLEVBQ0wsU0FBUyxHQUNzQjtJQUMvQixNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFTLGlDQUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRTNFLElBQUksQ0FBQztRQUNILElBQUksVUFBOEIsQ0FBQztRQUVuQyxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssY0FBYyxFQUFFLENBQUM7WUFDbEMsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FFNUIsaUNBQXlCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDcEMsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUM7Z0JBQ3pDLE1BQU0sRUFBRSxPQUFPO2dCQUNmLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxhQUFhLENBQUM7Z0JBQzdCLE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRTthQUMvQixDQUFDLENBQUM7WUFDSCxVQUFVLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLFdBQVcsSUFBSSxTQUFTLENBQUM7UUFDbkQsQ0FBQzthQUFNLENBQUM7WUFDTiw4REFBOEQ7WUFDOUQsVUFBVSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQzdCLENBQUM7UUFFRCxJQUFJLENBQUMsVUFBVTtZQUFFLE9BQU87UUFFeEIsTUFBTSxJQUFBLGlFQUFrQyxFQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztZQUN0RCxLQUFLLEVBQUUsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFO1NBQ25DLENBQUMsQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxDQUFDLElBQUksQ0FDVCxtREFBbUQsS0FBSyxDQUFDLElBQUksTUFBTyxLQUFlLENBQUMsT0FBTyxFQUFFLENBQzlGLENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQztBQUVZLFFBQUEsTUFBTSxHQUFxQjtJQUN0QyxLQUFLLEVBQUUsQ0FBQyxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsa0JBQWtCLENBQUM7Q0FDaEUsQ0FBQyJ9