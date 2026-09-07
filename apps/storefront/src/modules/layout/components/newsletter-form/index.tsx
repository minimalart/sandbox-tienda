"use client";

import { useNewsletter } from "@lib/hooks/use-newsletter";
import { type NewsletterInput, newsletterSchema } from "@lib/validation/contact";
import { zodResolver } from "@lib/util/zod-resolver";
import FormInput from "@modules/common/components/form-input";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";

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

  if (isSuccess) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-4 py-3">
        <svg
          className="h-5 w-5 text-green-600 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-sm text-green-700 font-medium">
          ¡Te suscribiste correctamente!
        </span>
      </div>
    );
  }

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
        <Button
          className="shrink-0 whitespace-nowrap px-4 py-2"
          type="submit"
          disabled={isLoading}
          size="storefront"
          variant={isDesktop ? "storefrontOutline" : "storefront"}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
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
            </span>
          ) : (
            buttonText
          )}
        </Button>
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
