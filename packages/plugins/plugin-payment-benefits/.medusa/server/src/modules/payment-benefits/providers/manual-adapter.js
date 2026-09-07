"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualAdapter = void 0;
/**
 * Proveedor "manual": los beneficios se crean/editan a mano desde el backoffice.
 * No hay nada que sincronizar (no-op), pero implementa la interfaz para que el
 * dashboard y la resolución por código traten a todos los proveedores igual.
 */
exports.manualAdapter = {
    code: 'manual',
    supportsSync: false,
    async validate() {
        return { ok: true };
    },
    async sync(ctx) {
        const result = {
            provider_code: 'manual',
            status: 'ok',
            items_synced: 0,
            message: 'Los beneficios manuales no se sincronizan.',
        };
        await ctx.service.logSync({ ...result, started_at: new Date() });
        return result;
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFudWFsLWFkYXB0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9wYXltZW50LWJlbmVmaXRzL3Byb3ZpZGVycy9tYW51YWwtYWRhcHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFHQTs7OztHQUlHO0FBQ1UsUUFBQSxhQUFhLEdBQTJCO0lBQ25ELElBQUksRUFBRSxRQUFRO0lBQ2QsWUFBWSxFQUFFLEtBQUs7SUFFbkIsS0FBSyxDQUFDLFFBQVE7UUFDWixPQUFPLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDO0lBQ3RCLENBQUM7SUFFRCxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQW9CO1FBQzdCLE1BQU0sTUFBTSxHQUFlO1lBQ3pCLGFBQWEsRUFBRSxRQUFRO1lBQ3ZCLE1BQU0sRUFBRSxJQUFJO1lBQ1osWUFBWSxFQUFFLENBQUM7WUFDZixPQUFPLEVBQUUsNENBQTRDO1NBQ3RELENBQUM7UUFDRixNQUFNLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsR0FBRyxNQUFNLEVBQUUsVUFBVSxFQUFFLElBQUksSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ2pFLE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7Q0FDRixDQUFDIn0=