import {
  ensurePlaceholder,
  FloatingLabel,
  floatingControlClass,
} from "@modules/common/components/floating-field";
import React from "react";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  name: string;
  hasError?: boolean;
};

/**
 * Floating-label textarea, same pattern as the shared Input: label inside at
 * rest, floated to the top border on focus/content; the `placeholder`
 * example is visible only while focused.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ name, label, required, placeholder, hasError, rows = 4, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <textarea
          className={floatingControlClass({ hasError, textarea: true })}
          id={props.id ?? name}
          name={name}
          placeholder={ensurePlaceholder(placeholder)}
          required={required}
          rows={rows}
          {...props}
          ref={ref}
        />
        <FloatingLabel
          htmlFor={props.id ?? name}
          label={label}
          required={required}
          hasError={hasError}
          textarea
        />
      </div>
    );
  },
);

Textarea.displayName = "Textarea";

export default Textarea;
