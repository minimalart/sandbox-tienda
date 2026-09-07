"use client";

import React from "react";
import {
  PhoneInput as ReactPhoneInput,
  defaultCountries,
  parseCountry,
} from "react-international-phone";
import "react-international-phone/style.css";

const countries = defaultCountries
  .filter((c) => {
    const parsed = parseCountry(c);
    return parsed.iso2 === "ar" || parsed.iso2 === "uy";
  })
  .map((c) => {
    const parsed = parseCountry(c);
    if (parsed.iso2 === "ar") {
      return [
        parsed.name,
        parsed.iso2,
        parsed.dialCode,
        "... ... ....",
        ...(parsed.priority ? [parsed.priority] : []),
      ] as typeof c;
    }
    return c;
  });

type PhoneInputProps = {
  label?: string;
  value: string;
  onChange: (phone: string) => void;
  hasError?: boolean;
  required?: boolean;
  placeholder?: string;
};

const PhoneInput = ({
  label,
  value,
  onChange,
  hasError = false,
  required = false,
  placeholder = "+54",
}: PhoneInputProps) => {
  return (
    <div className="relative w-full">
      {/* The dial code keeps this field visually non-empty, so the label is
          always floated on the border (same look as the shared inputs). */}
      {label && (
        <span
          className={`pointer-events-none absolute top-0 left-3 z-[1] -translate-y-1/2 select-none rounded bg-white px-1 text-xs font-bold ${
            hasError ? "text-red-500" : "text-[--primary-color]"
          }`}
        >
          {label}
          {required ? <span className="ml-0.5 text-red-500">*</span> : null}
        </span>
      )}
      <ReactPhoneInput
        countries={countries}
        defaultCountry="ar"
        disableFormatting
        forceDialCode
        countrySelectorStyleProps={{
          buttonStyle: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        }}
        inputProps={{
          placeholder,
          style: { height: "42px", width: "85%" },
        }}
        onChange={onChange}
        style={
          {
            width: "100%",
            "--react-international-phone-height": "42px",
            "--react-international-phone-border-radius": "8px",
            "--react-international-phone-border-color": hasError
              ? "#ef4444"
              : "#d1d5db",
            "--react-international-phone-background-color": "#fff",
            "--react-international-phone-font-size": "16px",
            "--react-international-phone-text-color": "#111827",
            "--react-international-phone-country-selector-background-color-hover":
              "#f3f4f6",
          } as React.CSSProperties
        }
        value={value}
      />
    </div>
  );
};

export default PhoneInput;
