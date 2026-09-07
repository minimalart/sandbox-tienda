"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { resolveAndSetBranch } from "@lib/data/branch";
import type { AddressFormData } from "@modules/common/components/address-form-with-map";
import AddressFormWithMap from "@modules/common/components/address-form-with-map";
import { MapPin, XMark } from "@medusajs/icons";
import { useEffect, useState } from "react";

const DISMISS_KEY = "_branch_gate_dismissed";

/**
 * Non-blocking prompt shown when no branch is selected: lets the user set their
 * delivery address so the storefront switches to their branch's channel
 * (catalog/stock/pricing) and routes payment to that branch. Reuses the same
 * Google Places address form as checkout. Dismissible for the session.
 */
export default function BranchGate({
  googleMapsApiKey,
  hasBranch,
}: {
  googleMapsApiKey: string;
  hasBranch: boolean;
}) {
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Honor a prior dismiss within the session (avoids nagging on every load).
  useEffect(() => {
    if (hasBranch) {
      setDismissed(true);
      return;
    }
    const wasDismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    setDismissed(wasDismissed);
  }, [hasBranch]);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const handleSubmit = async (data: AddressFormData) => {
    if (data.latitude == null || data.longitude == null) {
      setError("Elegí tu dirección desde el buscador para ubicar tu zona.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const resolution = await resolveAndSetBranch(data.latitude, data.longitude);
      if (!resolution.covered) {
        setError(
          "Todavía no tenemos cobertura en esa dirección. Podés seguir navegando.",
        );
        setIsLoading(false);
        return;
      }
      // Branch set → reload so the whole app picks up the new channel.
      window.location.reload();
    } catch {
      setError("No pudimos validar tu dirección. Intentá de nuevo.");
      setIsLoading(false);
    }
  };

  if (hasBranch || dismissed) {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-center gap-2 bg-[--primary-soft-bg] p-2 text-center text-[--text-dark] text-sm small:p-3">
        <MapPin className="inline shrink-0" />
        <span>Ingresá tu dirección para ver productos y envíos de tu zona.</span>
        <button
          className="font-semibold text-[--primary-color] underline underline-offset-2"
          onClick={() => setOpen(true)}
          type="button"
        >
          Elegir mi zona
        </button>
        <button
          aria-label="Cerrar"
          className="ml-1 rounded p-0.5 text-[--icon-muted] hover:bg-black/5"
          onClick={dismiss}
          type="button"
        >
          <XMark />
        </button>
      </div>

      <Dialog className="relative z-[10000]" onClose={() => setOpen(false)} open={open}>
        <DialogBackdrop className="fixed inset-0 bg-gray-500/75" />
        <div className="fixed inset-0 z-[10000] w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-0 text-center sm:items-center sm:p-4">
            <DialogPanel className="relative w-full max-w-none transform rounded-t-2xl bg-white px-4 pt-5 pb-6 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:rounded-lg sm:p-6">
              <DialogTitle
                as="h3"
                className="mb-4 text-center font-semibold text-gray-900 text-lg"
              >
                ¿A dónde te lo enviamos?
              </DialogTitle>
              <AddressFormWithMap
                error={error}
                googleMapsApiKey={googleMapsApiKey}
                hideNameFields
                initialData={{ countryCode: "ar" }}
                isLoading={isLoading}
                onCancel={() => setOpen(false)}
                onSubmit={handleSubmit}
                submitLabel="Ver productos de mi zona"
              />
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
}
