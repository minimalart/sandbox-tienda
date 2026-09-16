'use client';

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useAddresses } from '@lib/hooks/use-addresses';
import useToggleState from '@lib/hooks/use-toggle-state';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { PencilSquare as Edit, Trash } from '@medusajs/icons';
import type { HttpTypes } from '@medusajs/types';
import AddressFormWithMap from '@modules/common/components/address-form-with-map';
import type { AddressFormData } from '@modules/common/components/address-form-with-map';
import Spinner from '@modules/common/icons/spinner';
import type React from 'react';
import { useCallback, useState } from 'react';

type EditAddressProps = {
  googleMapsApiKey: string;
  region: HttpTypes.StoreRegion;
  address: HttpTypes.StoreCustomerAddress;
  isActive?: boolean;
};

const EditAddress: React.FC<EditAddressProps> = ({
  googleMapsApiKey,
  address,
  isActive = false,
}) => {
  const [removing, setRemoving] = useState(false);
  const { state, open, close: closeModal } = useToggleState(false);
  const { updateAddress, deleteAddress, isLoading, error } = useAddresses();
  const [formError, setFormError] = useState<string | null>(null);

  const close = () => {
    setFormError(null);
    closeModal();
  };

  const handleSubmit = useCallback(
    async (data: AddressFormData) => {
      setFormError(null);

      const result = await updateAddress(address.id, {
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
        setFormError(result.error || 'Error al actualizar dirección');
      }
    },
    [address.id, updateAddress]
  );

  const initialData: Partial<AddressFormData> = {
    firstName: address.first_name || '',
    lastName: address.last_name || '',
    addressName: (address as any).address_name || '',
    address1: address.address_1 || '',
    address2: address.address_2 || '',
    city: address.city || '',
    province: address.province || '',
    postalCode: address.postal_code || '',
    countryCode: address.country_code || 'ar',
    phone: address.phone || '',
    latitude: address.metadata?.latitude ? Number(address.metadata.latitude) : null,
    longitude: address.metadata?.longitude ? Number(address.metadata.longitude) : null,
  };

  const removeAddress = useCallback(async () => {
    setRemoving(true);
    const result = await deleteAddress(address.id);
    setRemoving(false);
    if (result.success) {
      window.location.reload();
    }
  }, [address.id, deleteAddress]);

  const mapQuery = encodeURIComponent(
    [address.address_1, address.city, address.province, address.country_code?.toUpperCase()]
      .filter(Boolean)
      .join(', ')
  );

  return (
    <>
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gray-200 shadow-sm transition hover:border-green-200 hover:shadow-md"
        data-testid="address-container"
      >
        {/* Map preview */}
        <div className="relative h-36 w-full bg-gray-100">
          <iframe
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer"
            src={`https://maps.google.com/maps?q=${mapQuery}&z=15&output=embed`}
            title={`Mapa de ${address.address_1}`}
          />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-gray-200/50 ring-inset" />
        </div>

        <div className="flex flex-1 flex-col justify-between p-5">
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-base text-gray-900" data-testid="address-name">
              {(address as { address_name?: string | null }).address_name ||
                `${address.first_name ?? ''} ${address.last_name ?? ''}`.trim()}
            </p>
            {address.company && (
              <p className="text-gray-500 text-sm" data-testid="address-company">
                {address.company}
              </p>
            )}
            <div className="mt-1.5 space-y-0.5 text-gray-600 text-sm">
              <p data-testid="address-address">
                {address.address_1}
                {address.address_2 && <span>, {address.address_2}</span>}
              </p>
              <p data-testid="address-postal-city">
                {address.postal_code}, {address.city}
              </p>
              <p data-testid="address-province-country">
                {address.province && `${address.province}, `}
                {address.country_code?.toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-4">
            <button
              className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 font-semibold text-[--primary-color] text-sm hover:bg-green-100"
              data-testid="address-edit-button"
              onClick={open}
              type="button"
            >
              <Edit className="h-4 w-4" />
              Editar
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 font-semibold text-gray-600 text-sm hover:bg-gray-200"
              data-testid="address-delete-button"
              onClick={removeAddress}
              type="button"
            >
              {removing ? <Spinner className="h-4 w-4" /> : <Trash className="h-4 w-4" />}
              Eliminar
            </button>
          </div>
        </div>
      </div>

      <Dialog
        className="relative z-[10000]"
        data-testid="edit-address-modal"
        onClose={close}
        open={state}
      >
        <DialogBackdrop
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 data-enter:ease-out data-leave:ease-in"
          transition
        />
        <div className="fixed inset-0 z-[10000] w-screen cursor-modal-close overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-0 text-center sm:items-center sm:p-4">
            <DialogPanel
              className="cursor-auto relative w-full max-w-none transform rounded-t-2xl bg-white px-4 pt-5 pb-6 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 data-enter:ease-out data-leave:ease-in sm:my-8 sm:w-full sm:max-w-2xl sm:rounded-lg sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
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
                Editar dirección
              </DialogTitle>
              <AddressFormWithMap
                error={formError || error || null}
                googleMapsApiKey={googleMapsApiKey}
                hideNameFields
                initialData={initialData}
                isLoading={isLoading}
                onCancel={close}
                onSubmit={handleSubmit}
                submitLabel="Guardar cambios"
              />
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
};

export default EditAddress;
