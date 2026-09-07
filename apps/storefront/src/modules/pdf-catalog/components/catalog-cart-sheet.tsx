"use client";

import { useState } from "react";
import { MessageCircle, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { convertToLocale } from "@lib/util/money";
import { useCatalogCartStore } from "../catalog-cart.store";

// Mismo formato de precio que el drawer del carrito real: convertToLocale
// (sin símbolo) con prefijo "$ ".
function fmtPrice(amount: number | null, currency: string | null): string {
  if (amount == null) return "";
  return `$ ${convertToLocale({
    amount,
    currency_code: (currency || "ARS").toLowerCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    locale: "es-AR",
  })}`;
}

export function CatalogCartSheet({
  whatsappNumber,
}: {
  whatsappNumber?: string;
}) {
  const [open, setOpen] = useState(false);
  const { items, changeQuantity, removeItem, clear, getTotal, getItemCount } =
    useCatalogCartStore();

  const itemCount = getItemCount();
  const total = getTotal();
  const currency = items[0]?.currency ?? "ARS";

  const sendWhatsApp = () => {
    if (items.length === 0) return;
    const lines = items.map((item) => {
      const unit = item.price != null ? ` (${fmtPrice(item.price, item.currency)} c/u)` : "";
      return `- ${item.quantity}x ${item.name}${unit}`;
    });
    const message = `¡Hola! Me gustaría hacer el siguiente pedido:\n\n${lines.join(
      "\n"
    )}\n\nTotal: ${fmtPrice(total, currency)}`;
    const encoded = encodeURIComponent(message);
    // Con número configurado abre el chat directo; sin número, WhatsApp deja
    // elegir el contacto (comportamiento de poc-ipaper).
    const digits = (whatsappNumber ?? "").replace(/\D/g, "");
    const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
    window.open(`${base}?text=${encoded}`, "_blank");
  };

  return (
    <>
      {/* Botón flotante del carrito (color primario de la plantilla) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir pedido"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: "var(--primary-color)" }}
      >
        <ShoppingCart className="h-6 w-6" />
        {itemCount > 0 && (
          <span className="-right-1 -top-1 absolute flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-xs font-bold text-white">
            {itemCount}
          </span>
        )}
      </button>

      {/* Backdrop + panel (mismo lenguaje visual que el drawer del carrito) */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col bg-gray-50 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-gray-200 border-b bg-white px-6 py-4">
              <h2 className="font-semibold text-gray-900 text-lg">
                Mi pedido ({itemCount})
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShoppingCart className="mb-4 h-12 w-12 text-gray-300" />
                  <p className="text-gray-500 text-sm">El pedido está vacío</p>
                  <p className="mt-1 text-gray-400 text-xs">
                    Agregá productos tocando los puntos del catálogo
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {items.map((item) => (
                    <li
                      key={item.key}
                      className="flex gap-3 rounded-[14px] bg-white p-[13px] shadow-sm"
                    >
                      <div className="relative size-16 shrink-0 rounded-lg border border-gray-200 bg-white p-1">
                        {item.image ? (
                          // biome-ignore lint/a11y/useAltText: nombre como alt
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full rounded-md object-contain"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-md bg-gray-100 text-gray-300">
                            <ShoppingCart className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-between">
                        <h3 className="truncate font-medium text-gray-900 text-sm leading-snug">
                          {item.name}
                        </h3>
                        <div className="mt-2 flex items-end justify-between">
                          <div className="flex items-stretch divide-x divide-gray-200 overflow-hidden rounded-[10px] border border-gray-200">
                            {item.quantity <= 1 ? (
                              <button
                                type="button"
                                onClick={() => removeItem(item.key)}
                                aria-label="Quitar"
                                className="p-1.5 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => changeQuantity(item.key, -1)}
                                aria-label="Restar"
                                className="p-1.5 hover:bg-gray-100"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <span className="flex w-7 items-center justify-center font-medium text-xs tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => changeQuantity(item.key, 1)}
                              aria-label="Sumar"
                              className="p-1.5 hover:bg-gray-100"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {item.price != null && (
                            <span
                              className="font-semibold text-[15px]"
                              style={{ color: "#101828" }}
                            >
                              {fmtPrice(item.price * item.quantity, item.currency)}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-gray-200 border-t bg-white p-4 sm:px-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-bold text-[20px]" style={{ color: "#101828" }}>
                    Total
                  </span>
                  <span className="font-bold text-[20px]" style={{ color: "#101828" }}>
                    {fmtPrice(total, currency)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={sendWhatsApp}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-md font-medium text-white transition-colors"
                  style={{ backgroundColor: "var(--primary-color)" }}
                >
                  <MessageCircle className="h-5 w-5" />
                  Enviar pedido por WhatsApp
                </button>
                <button
                  type="button"
                  onClick={clear}
                  className="mt-2 h-11 w-full rounded-md border border-gray-200 bg-white font-medium text-gray-500 text-sm hover:bg-gray-50 hover:text-gray-700"
                >
                  Vaciar pedido
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
