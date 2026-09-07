"use client";

import { useCustomer } from "@lib/hooks/use-customer";
import {
  type CustomerDetailsInput,
  customerDetailsSchema,
} from "@lib/validation/profile";
import { zodResolver } from "@lib/util/zod-resolver";
import type { HttpTypes } from "@medusajs/types";
import FormInput from "@modules/common/components/form-input";
import PhoneInput from "@modules/common/components/phone-input";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

type Props = {
  customer: HttpTypes.StoreCustomer;
};

const CustomerDetailsCard = ({ customer }: Props) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { updateCustomer } = useCustomer();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<CustomerDetailsInput>({
    resolver: zodResolver(customerDetailsSchema),
    mode: "onChange",
    defaultValues: {
      first_name: customer.first_name ?? "",
      last_name: customer.last_name ?? "",
      phone: customer.phone ?? "",
    },
  });

  const handleOpen = () => {
    reset({
      first_name: customer.first_name ?? "",
      last_name: customer.last_name ?? "",
      phone: customer.phone ?? "",
    });
    setSaveError(null);
    setIsModalOpen(true);
  };

  const onSubmit = async (data: CustomerDetailsInput) => {
    setSaveError(null);
    setIsSaving(true);

    const result = await updateCustomer(data);

    if (result.success) {
      setIsModalOpen(false);
      window.location.reload();
    } else {
      setSaveError(result.error || "Error al guardar los datos");
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0px_5px_20px_0px_#0000000D]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-semibold text-base text-gray-900">Detalles</h2>
          <button
            className="text-gray-400 transition-colors hover:text-gray-600"
            onClick={handleOpen}
            type="button"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-gray-500 text-xs">Nombre</p>
            <div className="rounded-lg border border-gray-200 px-3 py-2.5 text-gray-900 text-sm">
              {customer.first_name || <span className="text-gray-400">-</span>}
            </div>
          </div>
          <div>
            <p className="mb-1 text-gray-500 text-xs">Apellidos</p>
            <div className="rounded-lg border border-gray-200 px-3 py-2.5 text-gray-900 text-sm">
              {customer.last_name || <span className="text-gray-400">-</span>}
            </div>
          </div>
          <div>
            <p className="mb-1 text-gray-500 text-xs">Correo electrónico</p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-500 text-sm">
              {customer.email}
            </div>
          </div>
          <div>
            <p className="mb-1 text-gray-500 text-xs">Celular</p>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-gray-900 text-sm">
              {customer.phone ? (
                <>
                  <span className="shrink-0 text-base leading-none">🇦🇷</span>
                  <span>{customer.phone}</span>
                </>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-5 text-left font-semibold text-gray-900 text-lg">
              Editar datos
            </h3>

            <form
              className="space-y-4"
              noValidate
              onSubmit={handleSubmit(onSubmit)}
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FormInput
                    label="Nombre"
                    placeholder="Ej: Juan"
                    required
                    hasError={!!errors.first_name}
                    type="text"
                    {...register("first_name")}
                  />
                  {errors.first_name && (
                    <p className="mt-1 text-red-600 text-xs">
                      {errors.first_name.message}
                    </p>
                  )}
                </div>
                <div>
                  <FormInput
                    label="Apellidos"
                    placeholder="Ej: Pérez"
                    required
                    hasError={!!errors.last_name}
                    type="text"
                    {...register("last_name")}
                  />
                  {errors.last_name && (
                    <p className="mt-1 text-red-600 text-xs">
                      {errors.last_name.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field }) => (
                    <PhoneInput
                      hasError={!!errors.phone}
                      label="Celular"
                      onChange={field.onChange}
                      value={field.value ?? ""}
                    />
                  )}
                />
                {errors.phone && (
                  <p className="mt-1 text-red-600 text-xs">
                    {errors.phone.message}
                  </p>
                )}
              </div>

              {saveError && (
                <p className="rounded-lg bg-red-50 p-3 text-red-800 text-sm">
                  {saveError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  className="flex-1 rounded-lg border border-gray-200 py-2.5 font-semibold text-gray-700 text-sm transition-colors hover:bg-gray-50"
                  onClick={() => setIsModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 rounded-lg bg-[--primary-color] py-2.5 font-semibold text-sm text-white transition-colors hover:bg-[--primary-color] disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={isSaving || !isValid}
                  type="submit"
                >
                  {isSaving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomerDetailsCard;
