import { ChevronUpDown } from "@medusajs/icons";
import { clx } from "@medusajs/ui";
import {
  forwardRef,
  type SelectHTMLAttributes,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type NativeSelectProps = {
  placeholder?: string;
  errors?: Record<string, unknown>;
  touched?: Record<string, unknown>;
} & SelectHTMLAttributes<HTMLSelectElement>;

const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    { placeholder = "Select...", defaultValue, className, children, ...props },
    ref
  ) => {
    const innerRef = useRef<HTMLSelectElement>(null);
    const [isPlaceholder, setIsPlaceholder] = useState(false);

    useImperativeHandle<HTMLSelectElement | null, HTMLSelectElement | null>(
      ref,
      () => innerRef.current
    );

    useEffect(() => {
      if (innerRef.current && innerRef.current.value === "") {
        setIsPlaceholder(true);
      } else {
        setIsPlaceholder(false);
      }
    }, [innerRef.current?.value]);

    return (
      <div>
        <div
          className={clx(
            "relative flex items-center rounded-md border border-ui-border-base bg-ui-bg-subtle text-base-regular hover:bg-ui-bg-field-hover",
            className,
            {
              "text-ui-fg-muted": isPlaceholder,
            }
          )}
          onBlur={() => innerRef.current?.blur()}
          onFocus={() => innerRef.current?.focus()}
        >
          <select
            defaultValue={defaultValue}
            ref={innerRef}
            {...props}
            className="flex-1 appearance-none border-none bg-transparent px-4 py-2.5 outline-none transition-colors duration-150"
          >
            <option disabled value="">
              {placeholder}
            </option>
            {children}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
            <ChevronUpDown />
          </span>
        </div>
      </div>
    );
  }
);

NativeSelect.displayName = "NativeSelect";

export default NativeSelect;
