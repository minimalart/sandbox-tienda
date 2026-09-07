"use client";

import type React from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  variant = "primary",
  className,
  "data-testid": dataTestId,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "transparent" | "danger" | null;
  className?: string;
  "data-testid"?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={`w-full min-h-[44px] rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-base text-white shadow-sm transition-colors hover:bg-[--primary-color-dark] focus:outline-none focus:ring-2 focus:ring-[--primary-color] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ""}`}
      data-testid={dataTestId}
      disabled={pending}
      type="submit"
    >
      {pending ? "Procesando..." : children}
    </button>
  );
}
