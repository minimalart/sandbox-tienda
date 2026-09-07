"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LoyaltyRewards;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
const react_1 = require("react");
// Un ícono por tipo de recompensa: camión para envíos, regalo para lo gratis,
// etiqueta para descuentos. `custom` cae en regalo (beneficio genérico).
const REWARD_ICON = {
    free_shipping: lucide_react_1.Truck,
    free_product: lucide_react_1.Gift,
    store_credit: lucide_react_1.Gift,
    custom: lucide_react_1.Gift,
    fixed_discount: lucide_react_1.Tag,
    percent_discount: lucide_react_1.Tag,
};
// Tinte del color primario: en Tailwind 3 el modificador de opacidad no aplica
// sobre una var CSS cruda, así que el fondo va inline con color-mix.
const primaryTint = (percent) => ({
    backgroundColor: `color-mix(in srgb, var(--primary-color) ${percent}%, white)`,
});
const STATUS_LABEL = {
    available: "Disponible",
    used: "Utilizado",
    expired: "Expirado",
    cancelled: "Cancelado",
    pending: "Pendiente",
};
function LoyaltyRewards() {
    const [rewards, setRewards] = (0, react_1.useState)([]);
    const [grants, setGrants] = (0, react_1.useState)([]);
    const [tier, setTier] = (0, react_1.useState)(null);
    const [pointsName, setPointsName] = (0, react_1.useState)("puntos");
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [redeeming, setRedeeming] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)(null);
    const load = (0, react_1.useCallback)(async () => {
        setLoading(true);
        try {
            const [r, g, t] = await Promise.all([
                fetch("/api/store/loyalty/rewards").then((x) => x.json()),
                fetch("/api/store/loyalty/grants").then((x) => x.json()),
                fetch("/api/store/loyalty/tier").then((x) => x.json()),
            ]);
            if (r.success) {
                setRewards(r.rewards ?? []);
                setPointsName(r.points_name ?? "puntos");
            }
            if (g.success)
                setGrants(g.grants ?? []);
            if (t.success)
                setTier({ tier: t.tier, next: t.next, toNext: t.toNext, metrics: t.metrics });
        }
        catch {
            // silently ignore — the page still shows the points overview
        }
        finally {
            setLoading(false);
        }
    }, []);
    (0, react_1.useEffect)(() => {
        load();
    }, [load]);
    const redeem = async (id) => {
        setRedeeming(id);
        setMessage(null);
        try {
            const res = await fetch("/api/store/loyalty/redeem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reward_id: id }),
            }).then((x) => x.json());
            if (!res.success) {
                setMessage({ kind: "error", text: res.message ?? "No se pudo canjear" });
            }
            else {
                setMessage({ kind: "ok", text: "¡Canje realizado! Encontrá tu beneficio abajo." });
                await load();
            }
        }
        catch {
            setMessage({ kind: "error", text: "No se pudo canjear" });
        }
        finally {
            setRedeeming(null);
        }
    };
    if (loading)
        return null;
    const availableGrants = grants.filter((g) => g.status === "available");
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [tier?.tier && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-gray-100 bg-gray-50/60 p-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-500", children: "Tu nivel" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-gray-900", children: tier.tier.name }), tier.next && ((0, jsx_runtime_1.jsxs)("p", { className: "mt-1 text-sm text-gray-500", children: ["Te faltan ", (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-gray-700", children: tier.toNext }), " para alcanzar", " ", tier.next.name, "."] }))] })), message && ((0, jsx_runtime_1.jsx)("div", { className: `rounded-lg px-4 py-2 text-sm ${message.kind === "ok" ? "bg-green-50 text-green-700" : "bg-rose-50 text-rose-700"}`, children: message.text })), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("h3", { className: "mb-3 font-semibold text-base text-gray-900", children: ["Canje\u00E1 tus ", pointsName] }), rewards.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-500", children: "No hay recompensas disponibles por ahora." })) : ((0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3", children: rewards.map((r) => {
                            const Icon = REWARD_ICON[r.type] ?? lucide_react_1.Gift;
                            return ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-[--primary-color]", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex h-11 w-11 flex-none items-center justify-center rounded-xl", style: primaryTint(12), children: (0, jsx_runtime_1.jsx)(Icon, { className: "h-5 w-5 text-[--primary-color]", strokeWidth: 1.75 }) }), (0, jsx_runtime_1.jsxs)("div", { className: "min-w-0", children: [(0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-gray-900 text-sm", children: r.name }), r.description && ((0, jsx_runtime_1.jsx)("p", { className: "mt-0.5 text-gray-500 text-xs", children: r.description }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-auto pt-3", children: [(0, jsx_runtime_1.jsxs)("span", { className: "inline-block rounded-full px-2.5 py-1 font-semibold text-[--primary-color] text-xs", style: primaryTint(10), children: [r.cost_points.toLocaleString("es-AR"), " ", pointsName] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => redeem(r.id), disabled: redeeming === r.id, className: "mt-4 min-h-[40px] w-full rounded-xl border border-[--primary-color] px-3 font-semibold text-[--primary-color] text-sm transition-colors hover:bg-[--primary-color] hover:text-white disabled:cursor-not-allowed disabled:opacity-50", children: redeeming === r.id ? "Canjeando…" : "Canjear" })] })] }, r.id));
                        }) }))] }), availableGrants.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "mb-3 font-semibold text-base text-gray-900", children: "Tus beneficios" }), (0, jsx_runtime_1.jsx)("ul", { className: "divide-y divide-gray-100 rounded-xl border border-gray-100", children: availableGrants.map((g) => ((0, jsx_runtime_1.jsxs)("li", { className: "flex items-center justify-between px-4 py-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-medium text-gray-900", children: g.reward?.name ?? "Beneficio" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500", children: g.benefit_type === "promotion"
                                                ? `Cupón: ${g.benefit_ref ?? ""}`
                                                : g.benefit_type === "store_credit"
                                                    ? "Saldo acreditado"
                                                    : "" })] }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-gray-500", children: STATUS_LABEL[g.status] ?? g.status })] }, g.id))) }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-xs text-gray-400", children: "Aplic\u00E1 tus cupones en el paso \u201CBeneficios\u201D del checkout." })] }))] }));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvc3RvcmVmcm9udC9hY2NvdW50L2xveWFsdHktcmV3YXJkcy9pbmRleC50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsWUFBWSxDQUFDOzs7QUF1RGIsaUNBb0tDOztBQXpORCwrQ0FBZ0Q7QUFFaEQsaUNBQXlEO0FBMEJ6RCw4RUFBOEU7QUFDOUUseUVBQXlFO0FBQ3pFLE1BQU0sV0FBVyxHQUErQjtJQUM5QyxhQUFhLEVBQUUsb0JBQUs7SUFDcEIsWUFBWSxFQUFFLG1CQUFJO0lBQ2xCLFlBQVksRUFBRSxtQkFBSTtJQUNsQixNQUFNLEVBQUUsbUJBQUk7SUFDWixjQUFjLEVBQUUsa0JBQUc7SUFDbkIsZ0JBQWdCLEVBQUUsa0JBQUc7Q0FDdEIsQ0FBQztBQUVGLCtFQUErRTtBQUMvRSxxRUFBcUU7QUFDckUsTUFBTSxXQUFXLEdBQUcsQ0FBQyxPQUFlLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDeEMsZUFBZSxFQUFFLDJDQUEyQyxPQUFPLFdBQVc7Q0FDL0UsQ0FBQyxDQUFDO0FBRUgsTUFBTSxZQUFZLEdBQTJCO0lBQzNDLFNBQVMsRUFBRSxZQUFZO0lBQ3ZCLElBQUksRUFBRSxXQUFXO0lBQ2pCLE9BQU8sRUFBRSxVQUFVO0lBQ25CLFNBQVMsRUFBRSxXQUFXO0lBQ3RCLE9BQU8sRUFBRSxXQUFXO0NBQ3JCLENBQUM7QUFFRixTQUF3QixjQUFjO0lBQ3BDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLEdBQUcsSUFBQSxnQkFBUSxFQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQ3JELE1BQU0sQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLEdBQUcsSUFBQSxnQkFBUSxFQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQ2xELE1BQU0sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEdBQUcsSUFBQSxnQkFBUSxFQUFrQixJQUFJLENBQUMsQ0FBQztJQUN4RCxNQUFNLENBQUMsVUFBVSxFQUFFLGFBQWEsQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBQyxRQUFRLENBQUMsQ0FBQztJQUN2RCxNQUFNLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBQyxJQUFJLENBQUMsQ0FBQztJQUM3QyxNQUFNLENBQUMsU0FBUyxFQUFFLFlBQVksQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBZ0IsSUFBSSxDQUFDLENBQUM7SUFDaEUsTUFBTSxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsR0FBRyxJQUFBLGdCQUFRLEVBQWdELElBQUksQ0FBQyxDQUFDO0lBRTVGLE1BQU0sSUFBSSxHQUFHLElBQUEsbUJBQVcsRUFBQyxLQUFLLElBQUksRUFBRTtRQUNsQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakIsSUFBSSxDQUFDO1lBQ0gsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDO2dCQUNsQyxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDekQsS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ3hELEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO2FBQ3ZELENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNkLFVBQVUsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDO2dCQUM1QixhQUFhLENBQUMsQ0FBQyxDQUFDLFdBQVcsSUFBSSxRQUFRLENBQUMsQ0FBQztZQUMzQyxDQUFDO1lBQ0QsSUFBSSxDQUFDLENBQUMsT0FBTztnQkFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUMsQ0FBQztZQUN6QyxJQUFJLENBQUMsQ0FBQyxPQUFPO2dCQUFFLE9BQU8sQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUMvRixDQUFDO1FBQUMsTUFBTSxDQUFDO1lBQ1AsNkRBQTZEO1FBQy9ELENBQUM7Z0JBQVMsQ0FBQztZQUNULFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNwQixDQUFDO0lBQ0gsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRVAsSUFBQSxpQkFBUyxFQUFDLEdBQUcsRUFBRTtRQUNiLElBQUksRUFBRSxDQUFDO0lBQ1QsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUVYLE1BQU0sTUFBTSxHQUFHLEtBQUssRUFBRSxFQUFVLEVBQUUsRUFBRTtRQUNsQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDakIsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2pCLElBQUksQ0FBQztZQUNILE1BQU0sR0FBRyxHQUFHLE1BQU0sS0FBSyxDQUFDLDJCQUEyQixFQUFFO2dCQUNuRCxNQUFNLEVBQUUsTUFBTTtnQkFDZCxPQUFPLEVBQUUsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUU7Z0JBQy9DLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxDQUFDO2FBQ3hDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQ3pCLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2pCLFVBQVUsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxPQUFPLElBQUksb0JBQW9CLEVBQUUsQ0FBQyxDQUFDO1lBQzNFLENBQUM7aUJBQU0sQ0FBQztnQkFDTixVQUFVLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxnREFBZ0QsRUFBRSxDQUFDLENBQUM7Z0JBQ25GLE1BQU0sSUFBSSxFQUFFLENBQUM7WUFDZixDQUFDO1FBQ0gsQ0FBQztRQUFDLE1BQU0sQ0FBQztZQUNQLFVBQVUsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLG9CQUFvQixFQUFFLENBQUMsQ0FBQztRQUM1RCxDQUFDO2dCQUFTLENBQUM7WUFDVCxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckIsQ0FBQztJQUNILENBQUMsQ0FBQztJQUVGLElBQUksT0FBTztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRXpCLE1BQU0sZUFBZSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssV0FBVyxDQUFDLENBQUM7SUFFdkUsT0FBTyxDQUNMLGlDQUFLLFNBQVMsRUFBQyxXQUFXLGFBQ3ZCLElBQUksRUFBRSxJQUFJLElBQUksQ0FDYixpQ0FBSyxTQUFTLEVBQUMscURBQXFELGFBQ2xFLDhCQUFHLFNBQVMsRUFBQyx1QkFBdUIseUJBQWEsRUFDakQsOEJBQUcsU0FBUyxFQUFDLHFDQUFxQyxZQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFLLEVBQ3RFLElBQUksQ0FBQyxJQUFJLElBQUksQ0FDWiwrQkFBRyxTQUFTLEVBQUMsNEJBQTRCLDJCQUM3QixpQ0FBTSxTQUFTLEVBQUMsMkJBQTJCLFlBQUUsSUFBSSxDQUFDLE1BQU0sR0FBUSxvQkFBZSxHQUFHLEVBQzNGLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxTQUNiLENBQ0wsSUFDRyxDQUNQLEVBRUEsT0FBTyxJQUFJLENBQ1YsZ0NBQ0UsU0FBUyxFQUFFLGdDQUNULE9BQU8sQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDLENBQUMsMEJBQ3pELEVBQUUsWUFFRCxPQUFPLENBQUMsSUFBSSxHQUNULENBQ1AsRUFFRCw0Q0FDRSxnQ0FBSSxTQUFTLEVBQUMsNENBQTRDLGlDQUFhLFVBQVUsSUFBTSxFQUN0RixPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FDdEIsOEJBQUcsU0FBUyxFQUFDLHVCQUF1QiwwREFBOEMsQ0FDbkYsQ0FBQyxDQUFDLENBQUMsQ0FDRixnQ0FBSyxTQUFTLEVBQUMsc0RBQXNELFlBQ2xFLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTs0QkFDakIsTUFBTSxJQUFJLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxtQkFBSSxDQUFDOzRCQUN6QyxPQUFPLENBQ0wsaUNBRUUsU0FBUyxFQUFDLGdIQUFnSCxhQUUxSCxpQ0FBSyxTQUFTLEVBQUMsd0JBQXdCLGFBQ3JDLGdDQUNFLFNBQVMsRUFBQyxpRUFBaUUsRUFDM0UsS0FBSyxFQUFFLFdBQVcsQ0FBQyxFQUFFLENBQUMsWUFFdEIsdUJBQUMsSUFBSSxJQUFDLFNBQVMsRUFBQyxnQ0FBZ0MsRUFBQyxXQUFXLEVBQUUsSUFBSSxHQUFJLEdBQ2xFLEVBQ04saUNBQUssU0FBUyxFQUFDLFNBQVMsYUFDdEIsOEJBQUcsU0FBUyxFQUFDLHFDQUFxQyxZQUFFLENBQUMsQ0FBQyxJQUFJLEdBQUssRUFDOUQsQ0FBQyxDQUFDLFdBQVcsSUFBSSxDQUNoQiw4QkFBRyxTQUFTLEVBQUMsOEJBQThCLFlBQUUsQ0FBQyxDQUFDLFdBQVcsR0FBSyxDQUNoRSxJQUNHLElBQ0YsRUFHTixpQ0FBSyxTQUFTLEVBQUMsY0FBYyxhQUMzQixrQ0FDRSxTQUFTLEVBQUMsb0ZBQW9GLEVBQzlGLEtBQUssRUFBRSxXQUFXLENBQUMsRUFBRSxDQUFDLGFBRXJCLENBQUMsQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxPQUFHLFVBQVUsSUFDOUMsRUFDUCxtQ0FDRSxJQUFJLEVBQUMsUUFBUSxFQUNiLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUMzQixRQUFRLEVBQUUsU0FBUyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQzVCLFNBQVMsRUFBQyxxT0FBcU8sWUFFOU8sU0FBUyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsU0FBUyxHQUN2QyxJQUNMLEtBbENELENBQUMsQ0FBQyxFQUFFLENBbUNMLENBQ1AsQ0FBQzt3QkFDSixDQUFDLENBQUMsR0FDRSxDQUNQLElBQ0csRUFFTCxlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUM3Qiw0Q0FDRSwrQkFBSSxTQUFTLEVBQUMsNENBQTRDLCtCQUFvQixFQUM5RSwrQkFBSSxTQUFTLEVBQUMsNERBQTRELFlBQ3ZFLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQzFCLGdDQUFlLFNBQVMsRUFBQyw2Q0FBNkMsYUFDcEUsNENBQ0UsOEJBQUcsU0FBUyxFQUFDLG1DQUFtQyxZQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxJQUFJLFdBQVcsR0FBSyxFQUNwRiw4QkFBRyxTQUFTLEVBQUMsdUJBQXVCLFlBQ2pDLENBQUMsQ0FBQyxZQUFZLEtBQUssV0FBVztnREFDN0IsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFdBQVcsSUFBSSxFQUFFLEVBQUU7Z0RBQ2pDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxLQUFLLGNBQWM7b0RBQ2pDLENBQUMsQ0FBQyxrQkFBa0I7b0RBQ3BCLENBQUMsQ0FBQyxFQUFFLEdBQ04sSUFDQSxFQUNOLGlDQUFNLFNBQVMsRUFBQyx1QkFBdUIsWUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEdBQVEsS0FYNUUsQ0FBQyxDQUFDLEVBQUUsQ0FZUixDQUNOLENBQUMsR0FDQyxFQUNMLDhCQUFHLFNBQVMsRUFBQyw0QkFBNEIsd0ZBRXJDLElBQ0EsQ0FDUCxJQUNHLENBQ1AsQ0FBQztBQUNKLENBQUMifQ==