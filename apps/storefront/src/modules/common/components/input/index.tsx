import { Label } from "@medusajs/ui";
import {
  ensurePlaceholder,
  FloatingLabel,
  floatingControlClass,
} from "@modules/common/components/floating-field";
import Eye from "@modules/common/icons/eye";
import EyeOff from "@modules/common/icons/eye-off";
import React, { useEffect, useImperativeHandle, useState } from "react";

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  errors?: Record<string, unknown>;
  touched?: Record<string, unknown>;
  name: string;
  topLabel?: string;
  hasError?: boolean;
};

/**
 * Site-wide floating-label input. At rest the label sits inside the field;
 * on focus/content it floats to the top border (small, bold, brand color).
 * `placeholder` is the example value, visible only while focused.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { type, name, label, touched, required, topLabel, placeholder, hasError, ...props },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [inputType, setInputType] = useState(type);

    useEffect(() => {
      if (type === "password" && showPassword) {
        setInputType("text");
      }

      if (type === "password" && !showPassword) {
        setInputType("password");
      }
    }, [type, showPassword]);

    useImperativeHandle(ref, () => inputRef.current!);

    const isPassword = type === "password";

    return (
      <div className="flex w-full flex-col">
        {topLabel && (
          <Label className="txt-compact-medium-plus mb-2">{topLabel}</Label>
        )}
        <div className="relative w-full">
          <input
            className={floatingControlClass({ hasError, rightIcon: isPassword })}
            id={props.id ?? name}
            name={name}
            placeholder={ensurePlaceholder(placeholder)}
            required={required}
            type={inputType}
            {...props}
            ref={inputRef}
          />
          <FloatingLabel
            htmlFor={props.id ?? name}
            label={label}
            required={required}
            hasError={hasError}
          />
          {isPassword && (
            <button
              className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 outline-none transition-colors hover:text-gray-600"
              onClick={() => setShowPassword(!showPassword)}
              type="button"
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <Eye /> : <EyeOff />}
            </button>
          )}
        </div>
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;
