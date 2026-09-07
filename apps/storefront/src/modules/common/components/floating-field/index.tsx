import type React from "react";

/**
 * Shared building blocks for the site-wide floating-label field pattern
 * (Minimalart home style):
 *
 * - At rest (empty + unfocused) the label sits inside the field where the
 *   placeholder would be, and the example placeholder is hidden.
 * - On focus or when the field has content, the label floats to the top
 *   border (small, bold, brand color, with a background patch so it does not
 *   clash with the border) and the example placeholder becomes visible.
 * - Required fields show an asterisk in the label.
 *
 * Pure CSS (peer + :placeholder-shown): no JS state, no layout jumps, works
 * for <input> and <textarea> on mobile and desktop. The control must have a
 * placeholder (a blank " " is used when no example is provided) and must be
 * rendered BEFORE the label with the `peer` class.
 */

const CONTROL_BASE =
  "peer w-full rounded-lg border bg-white text-base text-gray-900 outline-none transition-colors " +
  "placeholder:text-transparent focus:placeholder:text-gray-400";

const CONTROL_OK =
  "border-gray-300 focus:border-[--primary-color] focus:ring-1 focus:ring-[--primary-color]";

const CONTROL_ERROR =
  "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500";

const LABEL_BASE =
  "pointer-events-none absolute z-[1] select-none rounded bg-white px-1 text-base text-gray-400 " +
  "transition-all duration-200 " +
  "peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs peer-focus:font-bold " +
  "peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:-translate-y-1/2 " +
  "peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-bold";

const LABEL_OK =
  "peer-focus:text-[--primary-color] peer-[:not(:placeholder-shown)]:text-[--primary-color]";

const LABEL_ERROR =
  "text-red-400 peer-focus:text-red-500 peer-[:not(:placeholder-shown)]:text-red-500";

/** Rest position when a left icon is present: label starts after the icon. */
const LABEL_ICON_OFFSET =
  "left-10 peer-focus:left-3 peer-[:not(:placeholder-shown)]:left-3";

export function floatingControlClass(opts?: {
  hasError?: boolean;
  leftIcon?: boolean;
  rightIcon?: boolean;
  textarea?: boolean;
}): string {
  return [
    CONTROL_BASE,
    opts?.hasError ? CONTROL_ERROR : CONTROL_OK,
    opts?.textarea ? "py-2.5" : "h-[42px]",
    opts?.leftIcon ? "pl-10" : "pl-3",
    opts?.rightIcon ? "pr-10" : "pr-3",
  ].join(" ");
}

export function floatingLabelClass(opts?: {
  hasError?: boolean;
  leftIcon?: boolean;
  textarea?: boolean;
}): string {
  return [
    LABEL_BASE,
    opts?.hasError ? LABEL_ERROR : LABEL_OK,
    opts?.textarea ? "top-[21px] -translate-y-1/2" : "top-1/2 -translate-y-1/2",
    opts?.leftIcon ? LABEL_ICON_OFFSET : "left-3",
  ].join(" ");
}

type FloatingLabelProps = {
  htmlFor?: string;
  label: string;
  required?: boolean;
  hasError?: boolean;
  leftIcon?: boolean;
  textarea?: boolean;
};

export const FloatingLabel = ({
  htmlFor,
  label,
  required,
  hasError,
  leftIcon,
  textarea,
}: FloatingLabelProps) => (
  <label
    className={floatingLabelClass({ hasError, leftIcon, textarea })}
    htmlFor={htmlFor}
  >
    {label}
    {required ? <span className="ml-0.5 text-red-500">*</span> : null}
  </label>
);

/** Placeholder must be non-empty for :placeholder-shown to track content. */
export const ensurePlaceholder = (placeholder?: string): string =>
  placeholder && placeholder.length > 0 ? placeholder : " ";

export type FloatingFieldCommonProps = {
  label: string;
  /** Example value shown only while the field is focused (e.g. "tuemail@ejemplo.com"). */
  placeholder?: string;
  hasError?: boolean;
};

export type { FloatingLabelProps };
export type FloatingFieldWrapperProps = React.PropsWithChildren<{
  className?: string;
}>;
