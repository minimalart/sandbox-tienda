"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = recalculateDynamicGroupsJob;
const utils_1 = require("@medusajs/framework/utils");
const dynamic_groups_1 = require("../modules/dynamic-groups");
const recalculate_dynamic_group_1 = require("../workflows/recalculate-dynamic-group");
/**
 * Barrido periódico de grupos dinámicos. Necesario para reglas TEMPORALES que
 * no disparan por evento: inactividad ("días sin comprar"), "cumpleaños del
 * mes", antigüedad. También reconcilia cualquier deriva. El tiempo real
 * (subscribers) cubre las transiciones por compra/alta; este cron cubre el resto.
 *
 * Schedule configurable con DYNAMIC_GROUPS_RECALC_CRON (default: 3am diario).
 */
async function recalculateDynamicGroupsJob(container) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const service = container.resolve(dynamic_groups_1.DYNAMIC_GROUPS_MODULE);
    const groups = await service.listDynamicGroups({ is_active: true });
    let ok = 0;
    let fail = 0;
    for (const g of groups) {
        if (!g.customer_group_id)
            continue;
        try {
            const { result } = await (0, recalculate_dynamic_group_1.recalculateDynamicGroupWorkflow)(container).run({
                input: { id: g.id },
            });
            ok++;
            logger.info(`[DynamicGroups cron] "${g.name}": ${result.members} miembros (+${result.added}/-${result.removed})`);
        }
        catch (e) {
            fail++;
            logger.warn(`[DynamicGroups cron] "${g.name}" falló: ${e.message}`);
        }
    }
    logger.info(`[DynamicGroups cron] recalculados ${ok} grupos (${fail} con error).`);
}
exports.config = {
    name: 'recalculate-dynamic-groups',
    schedule: process.env.DYNAMIC_GROUPS_RECALC_CRON || '0 3 * * *',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjYWxjdWxhdGUtZHluYW1pYy1ncm91cHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvam9icy9yZWNhbGN1bGF0ZS1keW5hbWljLWdyb3Vwcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFjQSw4Q0FpQ0M7QUE5Q0QscURBQXNFO0FBQ3RFLDhEQUFrRTtBQUVsRSxzRkFBeUY7QUFFekY7Ozs7Ozs7R0FPRztBQUNZLEtBQUssVUFBVSwyQkFBMkIsQ0FDdkQsU0FBMEI7SUFFMUIsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBUyxpQ0FBeUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMzRSxNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUMvQixzQ0FBcUIsQ0FDdEIsQ0FBQztJQUVGLE1BQU0sTUFBTSxHQUFHLE1BQU0sT0FBTyxDQUFDLGlCQUFpQixDQUFDLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDcEUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ1gsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBRWIsS0FBSyxNQUFNLENBQUMsSUFBSSxNQUFNLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsQ0FBQyxDQUFDLGlCQUFpQjtZQUFFLFNBQVM7UUFDbkMsSUFBSSxDQUFDO1lBQ0gsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBQSwyREFBK0IsRUFBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUM7Z0JBQ3RFLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBWSxFQUFFO2FBQzlCLENBQUMsQ0FBQztZQUNILEVBQUUsRUFBRSxDQUFDO1lBQ0wsTUFBTSxDQUFDLElBQUksQ0FDVCx5QkFBeUIsQ0FBQyxDQUFDLElBQUksTUFBTSxNQUFNLENBQUMsT0FBTyxlQUFlLE1BQU0sQ0FBQyxLQUFLLEtBQUssTUFBTSxDQUFDLE9BQU8sR0FBRyxDQUNyRyxDQUFDO1FBQ0osQ0FBQztRQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDWCxJQUFJLEVBQUUsQ0FBQztZQUNQLE1BQU0sQ0FBQyxJQUFJLENBQ1QseUJBQXlCLENBQUMsQ0FBQyxJQUFJLFlBQWEsQ0FBVyxDQUFDLE9BQU8sRUFBRSxDQUNsRSxDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7SUFFRCxNQUFNLENBQUMsSUFBSSxDQUNULHFDQUFxQyxFQUFFLFlBQVksSUFBSSxjQUFjLENBQ3RFLENBQUM7QUFDSixDQUFDO0FBRVksUUFBQSxNQUFNLEdBQUc7SUFDcEIsSUFBSSxFQUFFLDRCQUE0QjtJQUNsQyxRQUFRLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsSUFBSSxXQUFXO0NBQ2hFLENBQUMifQ==