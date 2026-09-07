"use client";
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const outline_1 = require("@heroicons/react/24/outline");
const navigation_1 = require("next/navigation");
const react_1 = __importDefault(require("react"));
const loyalty_context_1 = require("../../context/loyalty-context");
// Reuses the same cart promo-code apply path as DiscountCode. `promo_codes`
// replaces the whole manual list, so we always send existing + the new code.
async function applyCartPromoCodes(codes) {
    const res = await fetch("/api/store/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "applyPromotion", codes }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
        return { success: false, message: data?.message || `Error aplicando la recompensa (status ${res.status})`, cart: data?.cart };
    }
    return { success: true, cart: data?.cart };
}
// "Tus recompensas": lists the customer's AVAILABLE coupon grants and applies
// the selected one to the cart in one click. It doesn't compute discounts — the
// coupon (created at redeem time) carries the value; store-credit grants are
// applied via the "Usar saldo" toggle instead, so they're only hinted here.
const LoyaltyRewardsCheckout = ({ cart, onCartUpdate }) => {
    const [grants, setGrants] = react_1.default.useState([]);
    const [applying, setApplying] = react_1.default.useState(null);
    const [error, setError] = react_1.default.useState("");
    const { useCartStore } = (0, loyalty_context_1.useLoyaltyContext)();
    const setStoreCart = useCartStore
        ? useCartStore((s) => s.setCart)
        : undefined;
    const router = (0, navigation_1.useRouter)();
    react_1.default.useEffect(() => {
        fetch("/api/store/loyalty/grants")
            .then((r) => r.json())
            .then((d) => {
            if (d?.success)
                setGrants(d.grants ?? []);
        })
            .catch(() => { });
    }, []);
    const promotions = (cart.promotions ?? []);
    const appliedCodes = new Set(promotions.filter((p) => p?.code).map((p) => p.code));
    const couponGrants = grants.filter((g) => g.status === "available" &&
        g.benefit_type === "promotion" &&
        g.benefit_ref &&
        !appliedCodes.has(g.benefit_ref));
    const hasStoreCredit = grants.some((g) => g.status === "available" && g.benefit_type === "store_credit");
    if (couponGrants.length === 0 && !hasStoreCredit)
        return null;
    const apply = async (code) => {
        setApplying(code);
        setError("");
        const existing = promotions.filter((p) => p?.code && !p.is_automatic).map((p) => p.code);
        const res = await applyCartPromoCodes([...existing, code]);
        if (!res.success) {
            setError(res.message || "No se pudo aplicar la recompensa");
        }
        else {
            if (res.cart && setStoreCart)
                setStoreCart(res.cart);
            if (typeof window !== "undefined")
                window.dispatchEvent(new CustomEvent("cart-updated"));
            if (onCartUpdate)
                await onCartUpdate(res.cart ?? null);
            else
                router.refresh();
        }
        setApplying(null);
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mt-4 border-t border-gray-200 pt-4", "data-testid": "loyalty-rewards-checkout", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-3 flex items-center gap-1.5", children: [(0, jsx_runtime_1.jsx)(outline_1.StarIcon, { className: "h-4 w-4 text-amber-500" }), (0, jsx_runtime_1.jsx)("h4", { className: "font-semibold text-gray-900 text-sm", children: "Tus recompensas" })] }), couponGrants.length > 0 ? ((0, jsx_runtime_1.jsx)("ul", { className: "flex flex-col gap-2", children: couponGrants.map((g) => ((0, jsx_runtime_1.jsxs)("li", { className: "flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex min-w-0 flex-1 flex-col gap-0.5", children: [(0, jsx_runtime_1.jsx)("span", { className: "truncate font-semibold text-gray-900 text-sm", children: g.reward?.name ?? "Recompensa" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-xs text-gray-500", children: ["Cup\u00F3n ", g.benefit_ref] })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => apply(g.benefit_ref), disabled: applying === g.benefit_ref, className: "shrink-0 rounded-lg bg-[var(--primary-color)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50", children: applying === g.benefit_ref ? "Aplicando…" : "Aplicar" })] }, g.id))) })) : ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500", children: "Ten\u00E9s saldo de recompensa disponible: aplicalo con \u201CUsar saldo\u201D arriba." })), error && (0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-xs text-rose-600", children: error })] }));
};
exports.default = LoyaltyRewardsCheckout;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvc3RvcmVmcm9udC9jaGVja291dC9sb3lhbHR5LXJld2FyZHMtY2hlY2tvdXQvaW5kZXgudHN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFlBQVksQ0FBQzs7Ozs7OztBQUdiLHlEQUF1RDtBQUN2RCxnREFBNEM7QUFDNUMsa0RBQTBCO0FBQzFCLG1FQUFrRTtBQUVsRSw0RUFBNEU7QUFDNUUsNkVBQTZFO0FBQzdFLEtBQUssVUFBVSxtQkFBbUIsQ0FBQyxLQUFlO0lBQ2hELE1BQU0sR0FBRyxHQUFHLE1BQU0sS0FBSyxDQUFDLGlCQUFpQixFQUFFO1FBQ3pDLE1BQU0sRUFBRSxNQUFNO1FBQ2QsT0FBTyxFQUFFLEVBQUUsY0FBYyxFQUFFLGtCQUFrQixFQUFFO1FBQy9DLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLGdCQUFnQixFQUFFLEtBQUssRUFBRSxDQUFDO0tBQzFELENBQUMsQ0FBQztJQUNILE1BQU0sSUFBSSxHQUFHLE1BQU0sR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDaEQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksSUFBSSxFQUFFLE9BQU8sS0FBSyxLQUFLLEVBQUUsQ0FBQztRQUN2QyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQU8sSUFBSSx5Q0FBeUMsR0FBRyxDQUFDLE1BQU0sR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDaEksQ0FBQztJQUNELE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFDN0MsQ0FBQztBQWVELDhF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