"use client";

import { useCustomer } from "@lib/hooks/use-customer";
import {
  type ProfilePhoneInput,
  profilePhoneSchema,
} from "@lib/validation/profile";
import { zodResolver } from "@lib/util/zod-resolver";
import type { HttpTypes } from "@medusajs/types";
import PhoneInput from "@modules/common/components/phone-input";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import AccountInfo from "../account-info";

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer;
};

const ProfilePhone: React.FC<MyInformationProps> = ({ customer }) => {
  const { updateCustomer, isLoading, error } = useCustomer();
  const [successState, setSuccessState] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfilePhoneInput>({
    resolver: zodResolver(profilePhoneSchema),
    mode: "onChange",
    defaultValues: { phone: customer.phone ?? "" },
  });

  const onSubmit = async ({ phone }: ProfilePhoneInput) => {
    setFormError(null);
    setSuccessState(false);

    const result = await updateCustomer({ phone });
    if (result.success) {
      setSuccessState(true);
      window.location.reload();
    } else {
      setFormError(result.error || "Error al actualizar");
    }
  };

  const clearState = () => {
    setSuccessState(false);
    setFormError(null);
    reset({ phone: customer.phone ?? "" });
  };

  return (
    <AccountInfo
      clearState={clearState}
      currentInfo={customer.phone || "Sin teléfono"}
      data-testid="account-phone-editor"
      errorMessage={formError || error || undefined}
      isError={!!formError || !!error}
      isSuccess={successState}
      isLoading={isLoading}
      label="Teléfono"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="grid grid-cols-1 gap-y-2">
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <PhoneInput
              hasError={!!errors.phone}
              label="Teléfono"
              onChange={field.onChange}
              value={field.value ?? ""}
            />
          )}
        />
        {errors.phone && (
          <p className="text-red-600 text-xs">{errors.phone.message}</p>
        )}
      </div>
    </AccountInfo>
  );
};

export default ProfilePhone;
