"use client";

import {
  type PersonalInfoInput,
  personalInfoSchema,
} from "@lib/validation/checkout";
import { zodResolver } from "@lib/util/zod-resolver";
import type { HttpTypes } from "@medusajs/types";
import SubscriptionCheckbox from "@modules/common/components/subscription-checkbox";
import { goToCheckoutStep } from "@lib/util/checkout-step";
import FormInput from "@modules/common/components/form-input";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import InvoiceAFields, { type InvoiceAHandle } from "./invoice-a-fields";

type PersonalInfoProps = {
  cart: HttpTypes.StoreCart | null;
  customer: HttpTypes.StoreCustomer | null;
  onCartUpdate?: (
    cart?: HttpTypes.StoreCart | null,
  ) => Promise<HttpTypes.StoreCart | null>;
  /** Paso al que avanza "Continuar", ya resuelto contra el stepOrder visible. */
  nextStep?: string;
};

const PersonalInfo = ({ cart, customer, onCartUpdate, nextStep }: PersonalInfoProps) => {
  const isLoggedIn = !!customer;
  const cartId = cart?.id ?? null;
  // Estar logueado no garantiza tener nombre: el checkout guest de Medusa crea
  // el customer solo con el email y el login con Google se engancha a ese mismo
  // registro. Con la vista de solo lectura eso era un callejón sin salida —
  // mostraba "—" y "Continuar" mandaba "", que el API rechaza. Cuando falta el
  // nombre le damos el formulario para que lo complete.
  const hasFullName = Boolean(
    customer?.first_name?.trim() && customer?.last_name?.trim(),
  );
  const showAccountSummary = isLoggedIn && hasFullName;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const billingRef = useRef<InvoiceAHandle>(null);
  // Mismo criterio que los campos de arriba: con un obligatorio de facturación
  // sin completar, "Continuar" queda deshabilitado en vez de rebotar al tocarlo.
  const [billingValid, setBillingValid] = useState(true);
  const onBillingValidityChange = useCallback((valid: boolean) => {
    setBillingValid(valid);
    if (valid) setError(null);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<PersonalInfoInput>({
    resolver: zodResolver(personalInfoSchema),
    mode: "onChange",
    defaultValues: {
      first_name:
        cart?.shipping_address?.first_name || customer?.first_name || "",
      last_name:
        cart?.shipping_address?.last_name || customer?.last_name || "",
      email: cart?.email || customer?.email || "",
    },
  });
  const submitPersonalInfo = async ({
    email,
    first_name,
    last_name,
  }: PersonalInfoInput) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/store/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updatePersonalInfo",
          email,
          first_name,
          last_name,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Error al guardar los datos");
        return;
      }

      // Si el customer estaba sin nombre, guardarlo también en su perfil para
      // que no tenga que volver a tipearlo en la próxima compra. Best-effort:
      // el cart ya quedó guardado, un fallo acá no corta el checkout.
      if (isLoggedIn && !hasFullName) {
        try {
          await fetch("/api/store/customer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "update",
              data: { first_name, last_name },
            }),
          });
        } catch {
          // ignorado a propósito
        }
      }

      // Facturación (Factura A o consumidor final): validar + persistir al cart.
      if (billingRef.current) {
        if (!billingRef.current.validate()) {
          setError("Falta completar datos.");
          return;
        }
        const billingRes = await billingRef.current.persist();
        if (!billingRes.ok) {
          setError(billingRes.error || "No se pudieron guardar los datos de facturación.");
          return;
        }
      }

      if (onCartUpdate) {
        await onCartUpdate(result.cart);
      }

      // El paso siguiente lo decide la policy de la tienda: hardcodear "address"
      // empujaba a un paso inexistente en tiendas que lo ocultan.
      if (nextStep) goToCheckoutStep(nextStep);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al guardar";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {showAccountSummary ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-0.5 text-gray-500 text-xs">Nombre</p>
              <p className="font-medium text-gray-900 text-sm">
                {customer.first_name || "—"}
              </p>
            </div>
            <div>
              <p className="mb-0.5 text-gray-500 text-xs">Apellido</p>
              <p className="font-medium text-gray-900 text-sm">
                {customer.last_name || "—"}
              </p>
            </div>
          </div>
          <div>
            <p className="mb-0.5 text-gray-500 text-xs">Correo electrónico</p>
            <p className="font-medium text-gray-900 text-sm">
              {customer.email}
            </p>
          </div>
          <InvoiceAFields
            ref={billingRef}
            cartId={cartId}
            isLoggedIn={isLoggedIn}
            initialMetadata={cart?.metadata as Record<string, unknown> | null}
            onValidityChange={onBillingValidityChange}
          />
          <button
            className="mt-2 w-full rounded-[14px] bg-[--primary-color] px-4 py-3 font-semibold text-base text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting || !billingValid}
            onClick={() =>
              submitPersonalInfo({
                email: customer.email,
                first_name: customer.first_name || "",
                last_name: customer.last_name || "",
              })
            }
            type="button"
          >
            {isSubmitting ? "Procesando..." : "Continuar"}
          </button>
          {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit(submitPersonalInfo)}>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FormInput
                autoComplete="given-name"
                data-testid="personal-first-name-input"
                id="personal-first-name"
                label="Nombre"
                placeholder="Ej: Juan"
                hasError={!!errors.first_name}
                {...register("first_name")}
              />
              {errors.first_name && (
                <p className="mt-1 text-red-500 text-xs">
                  {errors.first_name.message}
                </p>
              )}
            </div>
            <div>
              <FormInput
                autoComplete="family-name"
                data-testid="personal-last-name-input"
                id="personal-last-name"
                label="Apellido"
                placeholder="Ej: Pérez"
                hasError={!!errors.last_name}
                {...register("last_name")}
              />
              {errors.last_name && (
                <p className="mt-1 text-red-500 text-xs">
                  {errors.last_name.message}
                </p>
              )}
            </div>
          </div>
          <FormInput
            autoComplete="email"
            data-testid="personal-email-input"
            id="personal-email"
            label="Correo electrónico"
            placeholder="ejemplo@correo.com"
            readOnly={isLoggedIn}
            title="Ingresá un correo electrónico válido."
            type="email"
            hasError={!!errors.email}
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-red-500 text-xs">{errors.email.message}</p>
          )}
          <div className="mt-4" />
          <InvoiceAFields
            ref={billingRef}
            cartId={cartId}
            isLoggedIn={isLoggedIn}
            initialMetadata={cart?.metadata as Record<string, unknown> | null}
            onValidityChange={onBillingValidityChange}
          />
          <button
            className="mt-4 w-full rounded-[14px] bg-[--primary-color] px-4 py-3 font-semibold text-base text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="submit-personal-button"
            disabled={isSubmitting || !isValid || !billingValid}
            type="submit"
          >
            {isSubmitting ? "Procesando..." : "Continuar"}
          </button>
          {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
        </form>
      )}
    </div>
  );
};

export default PersonalInfo;
