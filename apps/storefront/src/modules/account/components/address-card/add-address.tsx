'use client';

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { useAddresses } from '@lib/hooks/use-addresses';
import useToggleState from '@lib/hooks/use-toggle-state';
import type { HttpTypes } from '@medusajs/types';
import AddressFormWithMap from '@modules/common/components/address-form-with-map';
import type { AddressFormData } from '@modules/common/components/address-form-with-map';
import { useState } from 'react';

const AddAddress = ({
  googleMapsApiKey,
  addresses,
  customer,
}: {
  googleMapsApiKey: string;
  region: HttpTypes.StoreRegion;
  addresses: HttpTypes.StoreCustomerAddress[];
  customer?: HttpTypes.StoreCustomer | null;
}) => {
  const { state, open, close: closeModal } = useToggleState(false);
  const { addAddress, isLoading, error } = useAddresses();
  const [formError, setFormError] = useState<string | null>(null);

  const close = () => {
    setFormError(null);
    closeModal();
  };

  const handleSubmit = async (data: AddressFormData) => {
    setFormError(null);

    const result = await addAddress({
      first_name: data.firstName,
      last_name: data.lastName,
      address_1: data.address1,
      address_2: data.address2 || '',
      city: data.city,
      postal_code: data.postalCode,
      province: data.province,
      country_code: data.countryCode,
      phone: data.phone,
      address_name: data.addressName,
      is_default_shipping: addresses?.length === 0,
      metadata: {
        ...(data.latitude != null && data.longitude != null
          ? {
              latitude: String(data.latitude),
              longitude: String(data.longitude),
            }
          : {}),
      },
    });

    if (result.success) {
      close();
      window.location.reload();
    } else {
      setFormError(result.error || 'Error al guardar dirección');
    }
  };

  return (
    <>
      <button
        className="inline-flex items-center gap-1.5 rounded-lg bg-[--primary-color] px-3 py-2 font-semibold text-sm text-white shadow-xs transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[--primary-color] focus-visible:outline-offset-2"
        data-testid="add-address-button"
        onClick={open}
        type="button"
      >
        <PlusIcon aria-hidden="true" className="size-4" />
        Agregar dirección
      </button>

      <Dialog
        className="relative z-[10000]"
        data-testid="add-address-modal"
        onClose={close}
        open={state}
      >
        <DialogBackdrop
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 data-enter:ease-out data-leave:ease-in"
          transition
        />
        <div className="fixed inset-0 z-[10000] w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-0 text-center sm:items-center sm:p-4">
            <DialogPanel
              className="relative w-full max-w-none transform rounded-t-2xl bg-white px-4 pt-5 pb-6 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 data-enter:ease-out data-leave:ease-in sm:my-8 sm:w-full sm:max-w-2xl sm:rounded-lg sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
              transition
            >
              <button
                aria-label="Cerrar"
                className="absolute right-3 top-3 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                disabled={isLoading}
                onClick={close}
                type="button"
              >
                <XMarkIcon aria-hidden="true" className="size-5" />
              </button>
              <DialogTitle as="h3" className="mb-4 text-center font-semibold text-gray-900 text-lg">
                Agregar nueva dirección
              </DialogTitle>
              <AddressFormWithMap
                error={formError || error || null}
                googleMapsApiKey={googleMapsApiKey}
                hideNameFields
                initialData={{
                  firstName: customer?.first_name || '',
                  lastName: customer?.last_name || '',
                }}
                isLoading={isLoading}
                onCancel={close}
                onSubmit={handleSubmit}
              />
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
};

export default AddAddress;
