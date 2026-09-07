"use client";

import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";

type LogoutConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
};

export default function LogoutConfirmModal({
  open,
  onClose,
  onConfirm,
  isLoading,
}: LogoutConfirmModalProps) {
  return (
    <Dialog className="relative z-50" onClose={onClose} open={open}>
      <DialogBackdrop className="fixed inset-0 bg-black/30 transition-opacity" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex flex-col gap-3 text-center">
            <h3 className="font-bold text-gray-900 text-xl">
              ¿Querés cerrar sesión?
            </h3>
            <p className="text-gray-500 text-sm">
              Vas a salir de tu cuenta. Podrás volver a ingresar cuando quieras.
            </p>
            <div className="mt-2 flex flex-col lg:flex-row gap-3">
              <button
                className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                disabled={isLoading}
                onClick={onConfirm}
                type="button"
              >
                {isLoading ? "Cerrando..." : "Cerrar sesión"}
              </button>
              <button
                className="w-full rounded-xl border border-[#E5E7EB] px-4 py-2 font-medium text-gray-900 text-sm transition-colors hover:text-gray-900"
                disabled={isLoading}
                onClick={onClose}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
