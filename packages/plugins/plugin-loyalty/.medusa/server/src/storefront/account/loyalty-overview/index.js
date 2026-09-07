"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
const react_1 = require("react");
const TYPE_LABELS = {
    earn: "Puntos ganados",
    redeem: "Puntos canjeados",
    adjust: "Ajuste",
};
function formatDate(value) {
    if (!value)
        return "";
    try {
        return new Date(value).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    }
    catch {
        return "";
    }
}
const LoyaltyOverview = () => {
    const [balance, setBalance] = (0, react_1.useState)(0);
    const [transactions, setTransactions] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const fetchPoints = (0, react_1.useCallback)(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/store/points", { cache: "no-store" });
            const data = await response.json();
            if (!data.success || !data.points) {
                setError(data.message ?? "No se pudieron cargar tus puntos.");
                setBalance(0);
                setTransactions([]);
                return;
            }
            setBalance(data.points.balance);
            // Most recent first.
            setTransactions([...data.points.transactions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        }
        catch {
            setError("No se pudieron cargar tus puntos.");
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    (0, react_1.useEffect)(() => {
        fetchPoints();
    }, [fetchPoints]);
    if (isLoading) {
        return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", "data-testid": "loyalty-page-wrapper", children: [(0, jsx_runtime_1.jsx)("div", { className: "h-32 animate-pulse rounded-[24px] bg-gray-200" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: [1, 2, 3].map((item) => ((0, jsx_runtime_1.jsx)("div", { className: "h-16 animate-pulse rounded-xl bg-gray-100" }, item))) })] }));
    }
    if (error) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "mt-4 rounded-2xl bg-white px-6 py-12 text-center", children: (0, jsx_runtime_1.jsx)("p", { className: "text-gray-500 text-sm", children: error }) }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-8", "data-testid": "loyalty-page-wrapper", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-4 rounded-[24px] border border-gray-200 bg-[--mc-green-soft] px-6 py-8", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex h-14 w-14 flex-none items-center justify-center rounded-full", style: { backgroundColor: "color-mix(in srgb, var(--primary-color) 10%, white)" }, children: (0, jsx_runtime_1.jsx)(lucide_react_1.Star, { className: "h-7 w-7 text-[--primary-color]", strokeWidth: 1.75 }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-gray-500 text-sm", children: "Saldo disponible" }), (0, jsx_runtime_1.jsxs)("p", { className: "font-bold text-3xl text-gray-900", children: [balance.toLocaleString("es-AR"), " ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-base text-gray-500", children: "puntos" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold text-gray-900 text-sm/6", children: "Movimientos" }), transactions.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "mt-4 rounded-2xl bg-white px-6 py-12 text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Star, { className: "mx-auto h-12 w-12 text-gray-300", strokeWidth: 1.25 }), (0, jsx_runtime_1.jsx)("p", { className: "mt-4 text-gray-500 text-sm", children: "Todav\u00EDa no ten\u00E9s movimientos. Hac\u00E9 tu primera compra para empezar a sumar puntos." })] })) : ((0, jsx_runtime_1.jsx)("ul", { className: "mt-4 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white", children: transactions.map((tx) => {
                            const isPositive = tx.amount >= 0;
                            return ((0, jsx_runtime_1.jsxs)("li", { className: "flex items-center justify-between px-4 py-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "font-medium text-gray-900 text-sm", children: TYPE_LABELS[tx.type] ?? tx.type }), (0, jsx_runtime_1.jsxs)("p", { className: "text-gray-400 text-xs", children: [formatDate(tx.created_at), tx.order_display_id ? ` · Pedido #${tx.order_display_id}` : ""] })] }), (0, jsx_runtime_1.jsxs)("span", { className: `font-semibold text-sm ${isPositive ? "text-[--primary-color]" : "text-rose-500"}`, children: [isPositive ? "+" : "", tx.amount.toLocaleString("es-AR")] })] }, tx.id));
                        }) }))] })] }));
};
exports.default = LoyaltyOverview;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvc3RvcmVmcm9udC9hY2NvdW50L2xveWFsdHktb3ZlcnZpZXcvaW5kZXgudHN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFlBQVksQ0FBQzs7OztBQUViLCtDQUFvQztBQUNwQyxpQ0FBeUQ7QUFZekQsTUFBTSxXQUFXLEdBQTJCO0lBQzFDLElBQUksRUFBRSxnQkFBZ0I7SUFDdEIsTUFBTSxFQUFFLGtCQUFrQjtJQUMxQixNQUFNLEVBQUUsUUFBUTtDQUNqQixDQUFDO0FBRUYsU0FBUyxVQUFVLENBQUMsS0FBYTtJQUMvQixJQUFJLENBQUMsS0FBSztRQUFFLE9BQU8sRUFBRSxDQUFDO0lBQ3RCLElBQUksQ0FBQztRQUNILE9BQU8sSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsa0JBQWtCLENBQUMsT0FBTyxFQUFFO1lBQ2pELEdBQUcsRUFBRSxTQUFTO1lBQ2QsS0FBSyxFQUFFLE9BQU87WUFDZCxJQUFJLEVBQUUsU0FBUztTQUNoQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1AsT0FBTyxFQUFFLENBQUM7SUFDWixDQUFDO0FBQ0gsQ0FBQztBQUVELE1BQU0sZUFBZSxHQUFHLEdBQUcsRUFBRTtJQUMzQixNQUFNLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBQyxDQUFDLENBQUMsQ0FBQztJQUMxQyxNQUFNLENBQUMsWUFBWSxFQUFFLGVBQWUsQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBc0IsRUFBRSxDQUFDLENBQUM7SUFDMUUsTUFBTSxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsR0FBRyxJQUFBLGdCQUFRLEVBQUMsSUFBSSxDQUFDLENBQUM7SUFDakQsTUFBTSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsR0FBRyxJQUFBLGdCQUFRLEVBQWdCLElBQUksQ0FBQyxDQUFD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