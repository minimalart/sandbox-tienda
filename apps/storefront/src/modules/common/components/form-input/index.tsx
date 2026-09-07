"use client";

import {
  ensurePlaceholder,
  FloatingLabel,
  floatingControlClass,
} from "@modules/common/components/floating-field";
import React from "react";

type FormInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  icon?: React.ReactNode;
  hasError?: boolean;
};

/**
 * Floating-label input with optional left icon. When an icon is present the
 * resting label starts after it and slides to the border on focus/content.
 */
const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  (
    { label, icon, className, type = "text", placeholder, required, hasError, ...props },
    ref,
  ) => {
    return (
      <div className={`relative w-full ${className ?? ""}`}>
        {icon && (
          <span className="pointer-events-none absolute top-1/2 left-3 z-[1] -translate-y-1/2 text-gray-400">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          type={type}
          required={required}
          placeholder={ensurePlaceholder(placeholder)}
          className={`${floatingControlClass({ hasError, leftIcon: !!icon })} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 disabled:opacity-70`}
          {...props}
        />
        {label ? (
          <FloatingLabel
            htmlFor={props.id}
            label={label}
            required={required}
            hasError={hasError}
            leftIcon={!!icon}
          />
        ) : null}
      </div>
    );
  },
);

FormInput.displayName = "FormInput";

export default FormInput;
