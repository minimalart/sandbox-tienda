import { Input, Label, Text } from '@medusajs/ui';
import { useId, type ReactNode } from 'react';

export const selectClass =
  'w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2 text-sm text-ui-fg-base outline-none focus:border-ui-border-interactive';

export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {help && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {help}
        </Text>
      )}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <input
          aria-label={`Muestra: ${label}`}
          type="color"
          value={/^#[a-f\d]{6}$/i.test(value) ? value : '#ffffff'}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-ui-border-base"
        />
        <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-ui-border-base p-6 text-center text-sm text-ui-fg-subtle">
      {children}
    </div>
  );
}

export const newId = (prefix: string) => `${prefix}_${globalThis.crypto.randomUUID()}`;
