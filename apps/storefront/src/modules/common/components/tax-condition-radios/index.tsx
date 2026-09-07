"use client";

export type InvoiceATaxCondition = "responsable_inscripto" | "exento";

const OPTIONS: Array<{ value: InvoiceATaxCondition; label: string }> = [
  { value: "responsable_inscripto", label: "Resp. Inscripto" },
  { value: "exento", label: "Exento" },
];

type Props = {
  /** name único del grupo (el campo aparece en varios forms de la página). */
  name: string;
  value: InvoiceATaxCondition;
  onChange: (value: InvoiceATaxCondition) => void;
  disabled?: boolean;
};

/**
 * Condición frente al IVA como radios (solo las condiciones de Factura A).
 * Sin título visible a propósito: las opciones se explican solas y así la
 * fila queda alineada en altura con los FormInput vecinos (h-[44px]).
 */
export default function TaxConditionRadios({ name, value, onChange, disabled }: Props) {
  return (
    <fieldset
      aria-label="Condición frente al IVA"
      className={`flex h-[44px] items-center gap-5 ${disabled ? "opacity-50" : ""}`}
    >
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          className={`flex items-center gap-2 text-gray-700 text-sm ${
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            disabled={disabled}
            className="h-4 w-4 accent-[--primary-color]"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
