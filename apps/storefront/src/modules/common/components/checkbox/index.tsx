import { Checkbox, Label } from "@medusajs/ui";
import type React from "react";

type CheckboxProps = {
  checked?: boolean;
  onChange?: () => void;
  label: string;
  name?: string;
  "data-testid"?: string;
};

const CheckboxWithLabel: React.FC<CheckboxProps> = ({
  checked = true,
  onChange,
  label,
  name,
  "data-testid": dataTestId,
}) => (
  <div className="flex items-center space-x-2">
    <input
      type="hidden"
      name={name}
      value={checked ? "on" : "off"}
    />
    <Checkbox
      aria-checked={checked}
      checked={checked}
      // Tilde primario sobre fondo blanco: el contraste funciona sobre
      // cualquier superficie (ver CheckboxInput).
      className="flex items-center gap-x-2 text-base-regular data-[state=checked]:border-[--primary-color] data-[state=checked]:bg-white data-[state=checked]:text-[--primary-color] [&_svg]:text-[--primary-color]"
      data-testid={dataTestId}
      id="checkbox"
      onClick={onChange}
      role="checkbox"
      type="button"
    />
    <Label
      className="!transform-none !txt-medium"
      htmlFor="checkbox"
      size="large"
    >
      {label}
    </Label>
  </div>
);

export default CheckboxWithLabel;
