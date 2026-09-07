"use client";

import { Gift, Tag, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Reward = {
  id: string;
  name: string;
  description?: string | null;
  cost_points: number;
  type: string;
};

type Grant = {
  id: string;
  status: string;
  benefit_type?: string | null;
  benefit_ref?: string | null;
  points_spent: number;
  reward?: { name?: string } | null;
};

type TierInfo = {
  tier: { name?: string } | null;
  next: { name?: string; threshold?: number } | null;
  toNext: number;
  metrics: { points?: number } | null;
};

// Un ícono por tipo de recompensa: camión para envíos, regalo para lo gratis,
// etiqueta para descuentos. `custom` cae en regalo (beneficio genérico).
const REWARD_ICON: Record<string, LucideIcon> = {
  free_shipping: Truck,
  free_product: Gift,
  store_credit: Gift,
  custom: Gift,
  fixed_discount: Tag,
  percent_discount: Tag,
};

// Tinte del color primario: en Tailwind 3 el modificador de opacidad no aplica
// sobre una var CSS cruda, así que el fondo va inline con color-mix.
const primaryTint = (percent: number) => ({
  backgroundColor: `color-mix(in srgb, var(--primary-color) ${percent}%, white)`,
});

const STATUS_LABEL: Record<string, string> = {
  available: "Disponible",
  used: "Utilizado",
  expired: "Expirado",
  cancelled: "Cancelado",
  pending: "Pendiente",
};

export default function LoyaltyRewards() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [tier, setTier] = useState<TierInfo | null>(null);
  const [pointsName, setPointsName] = useState("puntos");
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
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
      if (g.success) setGrants(g.grants ?? []);
      if (t.success) setTier({ tier: t.tier, next: t.next, toNext: t.toNext, metrics: t.metrics });
    } catch {
      // silently ignore — the page still shows the points overview
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const redeem = async (id: string) => {
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
      } else {
        setMessage({ kind: "ok", text: "¡Canje realizado! Encontrá tu beneficio abajo." });
        await load();
      }
    } catch {
      setMessage({ kind: "error", text: "No se pudo canjear" });
    } finally {
      setRedeeming(null);
    }
  };

  if (loading) return null;

  const availableGrants = grants.filter((g) => g.status === "available");

  return (
    <div className="space-y-6">
      {tier?.tier && (
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <p className="text-sm text-gray-500">Tu nivel</p>
          <p className="text-lg font-semibold text-gray-900">{tier.tier.name}</p>
          {tier.next && (
            <p className="mt-1 text-sm text-gray-500">
              Te faltan <span className="font-medium text-gray-700">{tier.toNext}</span> para alcanzar{" "}
              {tier.next.name}.
            </p>
          )}
        </div>
      )}

      {message && (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${
            message.kind === "ok" ? "bg-green-50 text-green-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div>
        <h3 className="mb-3 font-semibold text-base text-gray-900">Canjeá tus {pointsName}</h3>
        {rewards.length === 0 ? (
          <p className="text-sm text-gray-500">No hay recompensas disponibles por ahora.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rewards.map((r) => {
              const Icon = REWARD_ICON[r.type] ?? Gift;
              return (
                <div
                  key={r.id}
                  className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-[--primary-color]"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 flex-none items-center justify-center rounded-xl"
                      style={primaryTint(12)}
                    >
                      <Icon className="h-5 w-5 text-[--primary-color]" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{r.name}</p>
                      {r.description && (
                        <p className="mt-0.5 text-gray-500 text-xs">{r.description}</p>
                      )}
                    </div>
                  </div>
                  {/* mt-auto: alinea el precio y el botón al pie de todas las
                      tarjetas de la fila, aunque la descripción sea más corta. */}
                  <div className="mt-auto pt-3">
                    <span
                      className="inline-block rounded-full px-2.5 py-1 font-semibold text-[--primary-color] text-xs"
                      style={primaryTint(10)}
                    >
                      {r.cost_points.toLocaleString("es-AR")} {pointsName}
                    </span>
                    <button
                      type="button"
                      onClick={() => redeem(r.id)}
                      disabled={redeeming === r.id}
                      className="mt-4 min-h-[40px] w-full rounded-xl border border-[--primary-color] px-3 font-semibold text-[--primary-color] text-sm transition-colors hover:bg-[--primary-color] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {redeeming === r.id ? "Canjeando…" : "Canjear"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {availableGrants.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold text-base text-gray-900">Tus beneficios</h3>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {availableGrants.map((g) => (
              <li key={g.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{g.reward?.name ?? "Beneficio"}</p>
                  <p className="text-xs text-gray-500">
                    {g.benefit_type === "promotion"
                      ? `Cupón: ${g.benefit_ref ?? ""}`
                      : g.benefit_type === "store_credit"
                        ? "Saldo acreditado"
                        : ""}
                  </p>
                </div>
                <span className="text-xs text-gray-500">{STATUS_LABEL[g.status] ?? g.status}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-400">
            Aplicá tus cupones en el paso “Beneficios” del checkout.
          </p>
        </div>
      )}
    </div>
  );
}
