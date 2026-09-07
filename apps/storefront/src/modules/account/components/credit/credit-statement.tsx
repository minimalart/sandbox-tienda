"use client";

import {
  type CreditAccountSummary,
  type CreditTransaction,
  listMyCreditTransactions,
} from "@lib/data/company-credit";
import FormInput from "@modules/common/components/form-input";
import { useState, useTransition } from "react";

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  suspended: "Suspendida",
  blocked: "Bloqueada",
};

const STATUS_CLASSES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  suspended: "bg-orange-100 text-orange-800",
  blocked: "bg-red-100 text-red-800",
};

const TYPE_LABELS: Record<string, string> = {
  compra: "Compra",
  pago: "Pago",
  nota_credito: "Nota de crédito",
  nota_debito: "Nota de débito",
  ajuste: "Ajuste",
};

const TYPE_OPTIONS = [
  { value: "", label: "Todos los tipos" },
  { value: "compra", label: "Compra" },
  { value: "pago", label: "Pago" },
  { value: "nota_credito", label: "Nota de crédito" },
  { value: "nota_debito", label: "Nota de débito" },
  { value: "ajuste", label: "Ajuste" },
];

function fmtMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(n);
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR");
  } catch {
    return iso;
  }
}

function referenceOf(t: CreditTransaction): string {
  if (t.order_id) return `Pedido ${t.order_id.slice(-8)}`;
  return t.notes ?? "—";
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-gray-500 text-xs">{label}</p>
      <p className={`mt-1 font-semibold text-lg ${accent ? "text-[--primary-color]" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

export default function CreditStatement({
  account,
  initialTransactions,
}: {
  account: CreditAccountSummary;
  initialTransactions: CreditTransaction[];
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isPending, startTransition] = useTransition();

  const applyFilters = () => {
    startTransition(async () => {
      const res = await listMyCreditTransactions({
        type: type || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 200,
      });
      setTransactions(res.transactions);
    });
  };

  const clearFilters = () => {
    setType("");
    setFrom("");
    setTo("");
    startTransition(async () => {
      const res = await listMyCreditTransactions({ limit: 200 });
      setTransactions(res.transactions);
    });
  };

  const exportCsv = () => {
    const headers = ["Fecha", "Tipo", "Referencia", "Monto", "Saldo"];
    const rows = transactions.map((t) => [
      fmtDate(t.created_at),
      TYPE_LABELS[t.type] ?? t.type,
      referenceOf(t).replace(/,/g, " "),
      String(t.amount),
      String(t.balance_after),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "cuenta-corriente.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-base/7 text-gray-900">Cuenta Corriente</h2>
          <p className="mt-1 text-gray-500 text-sm/6">
            Estado de tu línea de crédito comercial y movimientos.
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 font-medium text-xs ${
            STATUS_CLASSES[account.status] ?? "bg-gray-100 text-gray-700"
          }`}
        >
          {STATUS_LABELS[account.status] ?? account.status}
        </span>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Límite de crédito"
          value={fmtMoney(account.credit_limit, account.currency_code)}
        />
        <SummaryCard
          label="Saldo utilizado"
          value={fmtMoney(account.current_balance, account.currency_code)}
        />
        <SummaryCard
          accent
          label="Crédito disponible"
          value={fmtMoney(account.available_credit, account.currency_code)}
        />
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-gray-500 text-xs" htmlFor="tx-type">
              Tipo
            </label>
            <select
              className="h-[52px] w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-[--primary-color]"
              id="tx-type"
              onChange={(e) => setType(e.target.value)}
              value={type}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <FormInput
            label="Desde"
            onChange={(e) => setFrom(e.target.value)}
            type="date"
            value={from}
          />
          <FormInput
            label="Hasta"
            onChange={(e) => setTo(e.target.value)}
            type="date"
            value={to}
          />
          <div className="flex items-end gap-2">
            <button
              className="min-h-[44px] flex-1 rounded-xl bg-[--primary-color] px-4 font-semibold text-sm text-white disabled:opacity-60"
              disabled={isPending}
              onClick={applyFilters}
              type="button"
            >
              Filtrar
            </button>
            <button
              className="min-h-[44px] rounded-xl border border-gray-300 px-4 font-semibold text-gray-700 text-sm"
              onClick={clearFilters}
              type="button"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-gray-100 border-b px-4 py-3">
          <h3 className="font-semibold text-gray-900 text-sm">Movimientos</h3>
          <button
            className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 text-xs disabled:opacity-50"
            disabled={transactions.length === 0}
            onClick={exportCsv}
            type="button"
          >
            Exportar CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-gray-100 border-b text-gray-500 text-xs">
                <th className="px-4 py-2 text-left font-medium">Fecha</th>
                <th className="px-4 py-2 text-left font-medium">Tipo</th>
                <th className="px-4 py-2 text-left font-medium">Referencia</th>
                <th className="px-4 py-2 text-right font-medium">Monto</th>
                <th className="px-4 py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                    No hay movimientos para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr className="border-gray-50 border-b" key={t.id}>
                    <td className="px-4 py-2 text-gray-700">{fmtDate(t.created_at)}</td>
                    <td className="px-4 py-2 text-gray-700">{TYPE_LABELS[t.type] ?? t.type}</td>
                    <td className="px-4 py-2 text-gray-500">{referenceOf(t)}</td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {fmtMoney(t.amount, t.currency_code)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {fmtMoney(t.balance_after, t.currency_code)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
