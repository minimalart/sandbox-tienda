"use client";

import {
  type UpdatePasswordInput,
  updatePasswordSchema,
} from "@lib/validation/auth";
import { zodResolver } from "@lib/util/zod-resolver";
import type { HttpTypes } from "@medusajs/types";
import { toast } from "@medusajs/ui";
import PasswordInput from "@modules/common/components/password-input";
import React from "react";
import { useForm } from "react-hook-form";
import AccountInfo from "../account-info";

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer;
};

const ProfilePassword: React.FC<MyInformationProps> = ({ customer }) => {
  const [successState, setSuccessState] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    mode: "onChange",
    defaultValues: {
      old_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  // TODO: Add support for password updates
  const onSubmit = async (_data: UpdatePasswordInput) => {
    toast.info("La actualización de contraseña no está implementada");
  };

  const clearState = () => {
    setSuccessState(false);
    reset();
  };

  return (
    <AccountInfo
      clearState={clearState}
      currentInfo={<span>La contraseña no se muestra por razones de seguridad</span>}
      data-testid="account-password-editor"
      errorMessage={undefined}
      isError={false}
      isSuccess={successState}
      label="Contraseña"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-0.5">
          <PasswordInput
            data-testid="old-password-input"
            hasError={!!errors.old_password}
            label="Contraseña actual"
            required
            {...register("old_password")}
          />
          {errors.old_password && (
            <p className="text-red-600 text-xs">
              {errors.old_password.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <PasswordInput
            data-testid="new-password-input"
            hasError={!!errors.new_password}
            label="Nueva contraseña"
            placeholder="Mínimo 8 caracteres"
            required
            {...register("new_password")}
          />
          {errors.new_password && (
            <p className="text-red-600 text-xs">
              {errors.new_password.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <PasswordInput
            data-testid="confirm-password-input"
            hasError={!!errors.confirm_password}
            label="Confirmar contraseña"
            placeholder="Repetí la nueva contraseña"
            required
            {...register("confirm_password")}
          />
          {errors.confirm_password && (
            <p className="text-red-600 text-xs">
              {errors.confirm_password.message}
            </p>
          )}
        </div>
      </div>
    </AccountInfo>
  );
};

export default ProfilePassword;
