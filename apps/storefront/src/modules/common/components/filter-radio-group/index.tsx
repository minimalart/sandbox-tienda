import { EllipseMiniSolid } from "@medusajs/icons";
import { clx, Label, RadioGroup, Text } from "@medusajs/ui";

type FilterRadioGroupProps = {
  title: string;
  items: {
    value: string;
    label: string;
  }[];
  value: any;
  handleChange: (...args: any[]) => void;
  "data-testid"?: string;
};

const FilterRadioGroup = ({
  title,
  items,
  value,
  handleChange,
  "data-testid": dataTestId,
}: FilterRadioGroupProps) => (
  <div className="flex flex-col gap-x-3 gap-y-3">
    <Text className="txt-compact-small-plus text-ui-fg-muted">{title}</Text>
    <RadioGroup data-testid={dataTestId} onValueChange={handleChange}>
      {items?.map((i) => (
        <div
          className={clx("flex items-center gap-x-2", {
            "ml-[-23px]": i.value === value,
          })}
          key={i.value}
        >
          {i.value === value && <EllipseMiniSolid />}
          <RadioGroup.Item
            checked={i.value === value}
            className="peer hidden"
            id={i.value}
            value={i.value}
          />
          <Label
            className={clx(
              "!txt-compact-small !transform-none text-ui-fg-subtle hover:cursor-pointer",
              {
                "text-ui-fg-base": i.value === value,
              }
            )}
            data-active={i.value === value}
            data-testid="radio-label"
            htmlFor={i.value}
          >
            {i.label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  </div>
);

export default FilterRadioGroup;
