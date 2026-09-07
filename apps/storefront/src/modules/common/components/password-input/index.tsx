"use client";

import {
  ensurePlaceholder,
  FloatingLabel,
  floatingControlClass,
} from "@modules/common/components/floating-field";
import Eye from "@modules/common/icons/eye";
import EyeOff from "@modules/common/icons/eye-off";
import React, { useState } from "react";

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  hasError?: boolean;
  label?: string;
};

/**
 * Floating-label password input: lock icon on the left, show/hide toggle on
 * the right, label floats to the top border on focus/content.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ hasError = false, label, className, placeholder, required, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className={`relative w-full ${className ?? ""}`}>
        {/* Lock icon */}
        <span className="pointer-events-none absolute top-1/2 left-3 z-[1] -translate-y-1/2 text-gray-400">
          <svg
            fill="none"
            height="18"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            width="18"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>

        <input
          ref={ref}
          type={showPassword ? "text" : "password"}
          required={required}
          placeholder={ensurePlaceholder(placeholder)}
          className={floatingControlClass({ hasError, leftIcon: true, rightIcon: true })}
          {...props}
        />

        {label ? (
          <FloatingLabel
            htmlFor={props.id}
            label={label}
            required={required}
            hasError={hasError}
            leftIcon
          />
        ) : null}

        {/* Eye toggle */}
        <button
          className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 outline-none transition-colors hover:text-gray-600"
          onClick={() => setShowPassword((prev) => !prev)}
          type="button"
          tabIndex={-1}
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {showPassword ? <Eye size="18" /> : <EyeOff size="18" />}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
