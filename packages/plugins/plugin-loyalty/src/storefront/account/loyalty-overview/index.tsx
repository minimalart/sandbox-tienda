"use client";

import { Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type PointsTransaction = {
  id: string;
  amount: number;
  type: "earn" | "redeem" | "adjust" | string;
  reference: string | null;
  reference_id: string | null;
  order_display_id?: number | null;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  earn: "Puntos ganados",
  redeem: "Puntos canjeados",
  adjust: "Ajuste",
};

function formatDate(value: string): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

const LoyaltyOverview = () => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPoints = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/store/points", { cache: "no-store" });
      const data: {
        success: boolean;
        message?: string;
        points?: { balance: number; transactions: PointsTransaction[] };
      } = await response.json();

      if (!data.success || !data.points) {
        setError(data.message ?? "No se pudieron cargar tus puntos.");
        setBalance(0);
        setTransactions([]);
        return;
      }

      setBalance(data.points.balance);
      // Most recent first.
      setTransactions(
        [...data.points.transactions].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
    } catch {
      setError("No se pudieron cargar tus puntos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="loyalty-page-wrapper">
        <div className="h-32 animate-pulse rounded-[24px] bg-gray-200" />
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-2xl bg-white px-6 py-12 text-center">
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="loyalty-page-wrapper">
      {/* Balance card */}
      <div className="flex items-center gap-4 rounded-[24px] border border-gray-200 bg-[--mc-green-soft] px-6 py-8">
        {/* En Tailwind 3 el modificador de opacidad no aplica sobre una var CSS
            cruda (`bg-[--primary-color]/10` no tinta): el fondo va inline. */}
        <div
          className="flex h-14 w-14 flex-none items-center justify-center rounded-full"
          style={{ backgroundColor: "color-mix(in srgb, var(--primary-color) 10%, white)" }}
        >
          <Star className="h-7 w-7 text-[--primary-color]" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-gray-500 text-sm">Saldo disponible</p>
          <p className="font-bold text-3xl text-gray-900">
            {balance.toLocaleString("es-AR")}{" "}
            <span className="font-semibold text-base text-gray-500">puntos</span>
          </p>
        </div>
      </div>

      {/* History */}
      <div>
        <h3 className="font-semibold text-gray-900 text-sm/6">Movimientos</h3>
        {transactions.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-white px-6 py-12 text-center">
            <Star className="mx-auto h-12 w-12 text-gray-300" strokeWidth={1.25} />
            <p className="mt-4 text-gray-500 text-sm">
              Todavía no tenés movimientos. Hacé tu primera compra para empezar a sumar puntos.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {transactions.map((tx) => {
              const isPositive = tx.amount >= 0;
              return (
                <li key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {TYPE_LABELS[tx.type] ?? tx.type}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {formatDate(tx.created_at)}
                      {tx.order_display_id ? ` · Pedido #${tx.order_display_id}` : ""}
                    </p>
                  </div>
                  <span
                    className={`font-semibold text-sm ${
                      isPositive ? "text-[--primary-color]" : "text-rose-500"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {tx.amount.toLocaleString("es-AR")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default LoyaltyOverview;
