"use client";

import CheckboxInput from "@modules/common/components/checkbox-input";

type SubscriptionCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  label?: string;
};

const DEFAULT_LABEL =
  "Acepto recibir comunicaciones comerciales, promociones y novedades por correo electrónico. Podés darte de baja en cualquier momento.";

const SubscriptionCheckbox = ({
  checked,
  onChange,
  className = "",
  label = DEFAULT_LABEL,
}: SubscriptionCheckboxProps) => {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 !transform-none mt-2 ${className}`}
      data-testid="subscription-checkbox-label"
    >
      <CheckboxInput
        checked={checked}
        containerClassName="mt-0.5"
        data-testid="subscription-checkbox"
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="select-none text-gray-500 text-xs leading-snug">
        {label}
      </span>
    </label>
  );
};

export default SubscriptionCheckbox;
