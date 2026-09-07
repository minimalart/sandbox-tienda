import { Input, Label } from '@medusajs/ui';

/** Curated, popular Google Fonts. Inter is the default when none is picked. */
export const GOOGLE_FONTS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Raleway',
  'Nunito',
  'Work Sans',
  'Manrope',
  'DM Sans',
  'Rubik',
  'Mulish',
  'Quicksand',
  'Playfair Display',
  'Merriweather',
  'Oswald',
  'Source Sans 3',
] as const;

export const DEFAULT_FONT = 'Inter';
export const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Color field: native swatch picker + free-text hex input, kept in sync. */
export const ColorField = ({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (v: string) => void;
}) => {
  const swatch = HEX_RE.test(value) ? value : fallback;
  return (
    <div className="flex flex-col gap-y-2">
      <Label size="small">{label}</Label>
      <div className="flex items-center gap-x-2">
        <input
          type="color"
          aria-label={label}
          value={swatch}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-ui-border-base bg-ui-bg-field p-0.5"
        />
        <Input placeholder={fallback} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
};
