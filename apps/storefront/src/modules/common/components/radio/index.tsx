const Radio = ({
  checked,
  "data-testid": dataTestId,
}: {
  checked: boolean;
  "data-testid"?: string;
}) => (
  <>
    <button
      aria-checked="true"
      className="group relative flex h-5 w-5 items-center justify-center outline-none"
      data-state={checked ? "checked" : "unchecked"}
      data-testid={dataTestId || "radio-button"}
      role="radio"
      type="button"
    >
      <div className="group-focus:!shadow-borders-interactive-with-focus group-disabled:!bg-ui-bg-disabled group-disabled:!shadow-borders-base flex h-[14px] w-[14px] items-center justify-center rounded-full bg-ui-bg-base shadow-borders-base transition-all group-hover:shadow-borders-strong-with-shadow group-data-[state=checked]:bg-ui-bg-interactive group-data-[state=checked]:shadow-borders-interactive">
        {checked && (
          <span
            className="group flex items-center justify-center"
            data-state={checked ? "checked" : "unchecked"}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-ui-bg-base shadow-details-contrast-on-bg-interactive group-disabled:bg-ui-fg-disabled group-disabled:shadow-none" />
          </span>
        )}
      </div>
    </button>
  </>
);

export default Radio;
