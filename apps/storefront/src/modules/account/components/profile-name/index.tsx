"use client";

import { useCustomer } from "@lib/hooks/use-customer";
import {
  type ProfileNameInput,
  profileNameSchema,
} from "@lib/validation/profile";
import { zodResolver } from "@lib/util/zod-resolver";
import type { HttpTypes } from "@medusajs/types";
import Input from "@modules/common/components/input";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import AccountInfo from "../account-info";

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer;
};

const ProfileName: React.FC<MyInformationProps> = ({ customer }) => {
  const { updateCustomer, isLoading, error } = useCustomer();
  const [successState, setSuccessState] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileNameInput>({
    resolver: zodResolver(profileNameSchema),
    mode: "onChange",
    defaultValues: {
      first_name: customer.first_name ?? "",
      last_name: customer.last_name ?? "",
    },
  });

  const onSubmit = async (data: ProfileNameInput) => {
    setFormError(null);
    setSuccessState(false);

    const result = await updateCustomer(data);
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
    reset({
      first_name: customer.first_name ?? "",
      last_name: customer.last_name ?? "",
    });
  };

  return (
    <AccountInfo
      clearState={clearState}
      currentInfo={`${customer.first_name || ""} ${customer.last_name || ""}`}
      data-testid="account-name-editor"
      isError={!!formError || !!error}
      errorMessage={formError || error || undefined}
      isSuccess={successState}
      isLoading={isLoading}
      label="Nombre y apellido"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="grid grid-cols-2 gap-x-4">
        <div className="flex flex-col gap-0.5">
          <Input
            data-testid="first-name-input"
            label="Nombre"
            placeholder="Ej: Juan"
            required
            hasError={!!errors.first_name}
            {...register("first_name")}
          />
          {errors.first_name && (
            <p className="text-red-600 text-xs">
              {errors.first_name.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <Input
            data-testid="last-name-input"
            label="Apellido"
            placeholder="Ej: Pérez"
            required
            hasError={!!errors.last_name}
            {...register("last_name")}
          />
          {errors.last_name && (
            <p className="text-red-600 text-xs">{errors.last_name.message}</p>
          )}
        </div>
      </div>
    </AccountInfo>
  );
};

export default ProfileName;
