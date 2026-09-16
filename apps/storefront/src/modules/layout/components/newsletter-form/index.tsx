"use client";

import { useNewsletter } from "@lib/hooks/use-newsletter";
import { type NewsletterInput, newsletterSchema } from "@lib/validation/contact";
import { zodResolver } from "@lib/util/zod-resolver";
import FormInput from "@modules/common/components/form-input";
import { useForm } from "react-hook-form";
import PlaneButton from "@modules/common/components/plane-button";

type Props = {
  placeholder?: string;
  buttonText?: string;
  variant?: "desktop" | "mobile";
};

const NewsletterForm = ({
  placeholder = "ejemplo@correo.com",
  buttonText = "Suscribirse",
  variant = "desktop",
}: Props) => {
  const { isLoading, isSuccess, error, subscribe } = useNewsletter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewsletterInput>({
    resolver: zodResolver(newsletterSchema),
    mode: "onChange",
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: NewsletterInput) => {
    const result = await subscribe(email);
    if (result.success) {
      reset({ email: "" });
    }
  };

  const isDesktop = variant === "desktop";

  return (
    <form
      className="flex flex-col gap-2"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
    >
      <div
        className={`flex gap-2 ${
          isDesktop ? "flex-row" : "flex-col sm:flex-row"
        }`}
      >
        <FormInput
          className="min-w-0 flex-1"
          label="Email"
          placeholder={placeholder}
          type="email"
          autoComplete="email"
          disabled={isLoading}
          hasError={!!errors.email}
          {...register("email")}
        />
        <PlaneButton
          className="shrink-0 whitespace-nowrap px-4 py-2"
          type="submit"
          disabled={isLoading}
          isSuccess={isSuccess}
          successLabel="¡Listo!"
          size="storefront"
          variant={isDesktop ? "storefrontOutline" : "storefront"}
        >
          {isLoading ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Suscribiendo...
            </>
          ) : (
            buttonText
          )}
        </PlaneButton>
      </div>
      {(errors.email || error) && (
        <p className="text-xs text-red-600 px-1">
          {errors.email?.message ?? error}
        </p>
      )}
    </form>
  );
};

export default NewsletterForm;
