"use client";

import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import type { HttpTypes } from "@medusajs/types";
import {
  createReturn,
  listReturnReasons,
  listReturnShippingOptions,
  type ReturnReason,
  type ReturnShippingOption,
} from "@lib/data/returns";
import CheckboxInput from "@modules/common/components/checkbox-input";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  order: HttpTypes.StoreOrder;
  open: boolean;
  onClose: () => void;
};

export default function ReturnRequestModal({ order, open, onClose }: Props) {
  const router = useRouter();
  const [reasons, setReasons] = useState<ReturnReason[]>([]);
  const [options, setOptions] = useState<ReturnShippingOption[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [reasonId, setReasonId] = useState("");
  const [optionId, setOptionId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    Promise.all([listReturnReasons(), listReturnShippingOptions()])
      .then(([r, o]) => {
        setReasons(r);
        setOptions(o);
        if (o[0]) setOptionId(o[0].id);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const items = (order.items ?? []) as Array<
    HttpTypes.StoreOrderLineItem & { product_title?: string }
  >;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });

  const setQty = (id: string, qty: number, max: number) =>
    setSelected((prev) => ({ ...prev, [id]: Math.min(Math.max(1, qty || 1), max) }));

  const chosen = Object.keys(selected);

  const submit = async () => {
    setError(null);
    if (chosen.length === 0) {
      setError("Elegí al menos un producto para devolver.");
      return;
    }
    if (!optionId) {
      setError("No hay método de envío de devolución disponible. Escribinos por soporte.");
      return;
    }
    setSubmitting(true);
    const res = await createReturn({
      order_id: order.id,
      items: chosen.map((id) => ({
        id,
        quantity: selected[id],
        reason_id: reasonId || undefined,
      })),
      return_shipping_option_id: optionId,
      note: note || undefined,
    });
    setSubmitting(false);
    if (res.success) {
      setDone(true);
      router.refresh();
    } else {
      setError(res.error);
    }
  };

  return (
    <Dialog className="relative z-50" onClose={onClose} open={open}>
      <DialogBackdrop className="fixed inset-0 bg-black/30 transition-opacity" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel className="flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          {done ? (
            <div className="flex flex-col gap-3 text-center">
              <h3 className="font-bold text-gray-900 text-xl">¡Solicitud enviada!</h3>
              <p className="text-gray-500 text-sm">
                Recibimos tu pedido de devolución. Te vamos a contactar con los próximos
                pasos para el envío de retorno y el reembolso.
              </p>
              <button
                className="mt-2 w-full rounded-xl bg-gray-900 px-4 py-3 font-semibold text-sm text-white"
                onClick={onClose}
                type="button"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <>
              <div>
                <h3 className="font-bold text-gray-900 text-xl">Solicitar devolución</h3>
                <p className="mt-1 text-gray-500 text-sm">
                  Elegí qué querés devolver del pedido #{order.display_id}.
                </p>
              </div>

              {loading ? (
                <p className="text-gray-500 text-sm">Cargando opciones…</p>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    {items.map((it) => {
                      const max = it.quantity ?? 1;
                      const checked = Boolean(selected[it.id]);
                      const label =
                        (it.product_title || it.title || "Producto") +
                        (it.variant_title ? ` — ${it.variant_title}` : "");
                      return (
                        <label
                          key={it.id}
                          className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] p-3"
                        >
                          <CheckboxInput
                            checked={checked}
                            onChange={() => toggle(it.id)}
                          />
                          <span className="flex-1 text-gray-900 text-sm">{label}</span>
                          {checked && (
                            <input
                              className="w-16 rounded-lg border border-[#E5E7EB] px-2 py-1 text-sm"
                              max={max}
                              min={1}
                              onChange={(e) => setQty(it.id, Number(e.target.value), max)}
                              type="number"
                              value={selected[it.id]}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>

                  <select
                    className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
                    onChange={(e) => setReasonId(e.target.value)}
                    value={reasonId}
                  >
                    <option value="">Motivo (opcional)</option>
                    {reasons.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>

                  {options.length > 1 && (
                    <select
                      className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
                      onChange={(e) => setOptionId(e.target.value)}
                      value={optionId}
                    >
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <textarea
                    className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Comentario (opcional)"
                    rows={2}
                    value={note}
                  />

                  {options.length === 0 && (
                    <p className="text-amber-600 text-sm">
                      Todavía no hay método de envío de devolución configurado. Escribinos
                      por soporte para gestionarla.
                    </p>
                  )}
                  {error && <p className="text-red-600 text-sm">{error}</p>}

                  <div className="flex flex-col gap-3 lg:flex-row-reverse">
                    <button
                      className="w-full rounded-xl bg-[var(--primary-color)] px-4 py-3 font-semibold text-sm text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={submitting || options.length === 0}
                      onClick={submit}
                      type="button"
                    >
                      {submitting ? "Enviando…" : "Solicitar devolución"}
                    </button>
                    <button
                      className="w-full rounded-xl border border-[#E5E7EB] px-4 py-2 font-medium text-gray-900 text-sm transition-colors hover:bg-gray-50"
                      disabled={submitting}
                      onClick={onClose}
                      type="button"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
