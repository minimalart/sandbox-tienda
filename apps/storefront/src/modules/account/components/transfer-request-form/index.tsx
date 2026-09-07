"use client";

import { createTransferRequest } from "@lib/data/orders";
import { CheckCircleMiniSolid, XCircleSolid } from "@medusajs/icons";
import { Input } from "@medusajs/ui";
import { SubmitButton } from "@modules/checkout/components/submit-button";
import { useActionState, useEffect, useState } from "react";

export default function TransferRequestForm() {
  const [showSuccess, setShowSuccess] = useState(false);

  const [state, formAction] = useActionState(createTransferRequest, {
    success: false,
    error: null,
    order: null,
  });

  useEffect(() => {
    if (state.success && state.order) {
      setShowSuccess(true);
    }
  }, [state.success, state.order]);

  return (
    <div
      className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      data-testid="transfer-request-form"
    >
      <div>
        <h3 className="font-semibold text-base/7 text-gray-900">
          Vincular pedidos
        </h3>
        <p className="mt-1 text-gray-500 text-sm/6">
          ¿No encontrás un pedido en tu cuenta? Ingresá el ID y lo vinculamos
          para que puedas seguirlo desde aquí.
        </p>
      </div>
      <form
        action={formAction}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <Input
            className="w-full"
            aria-label="ID del pedido"
            name="order_id"
            placeholder="Ej: order_01ABC123"
            required
          />
        </div>
        <SubmitButton
          className="inline-flex w-full justify-center rounded-md bg-[--primary-color] px-4 py-2 font-semibold text-sm text-white shadow-none hover:bg-[--primary-color-dark] focus-visible:outline-2 focus-visible:outline-[--primary-color] focus-visible:outline-offset-2 sm:w-auto"
          data-testid="request-transfer-button"
        >
          Solicitar vinculación
        </SubmitButton>
      </form>
      {!state.success && state.error && (
        <p
          className="text-right font-medium text-rose-500 text-sm"
          data-testid="transfer-error"
        >
          {state.error}
        </p>
      )}
      {showSuccess && (
        <div
          className="flex flex-col gap-3 rounded-xl bg-green-50 p-4 text-green-900 text-sm sm:flex-row sm:items-center sm:justify-between"
          data-testid="transfer-success"
        >
          <div className="flex items-start gap-3">
            <CheckCircleMiniSolid className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-semibold">Solicitud enviada</p>
              <p className="text-green-800 text-sm">
                El pedido {state.order?.id} será revisado y enviamos la
                confirmación a {state.order?.email}.
              </p>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-2 font-semibold text-green-900 text-sm hover:text-green-700"
            onClick={() => setShowSuccess(false)}
            type="button"
          >
            <XCircleSolid className="h-4 w-4" />
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
