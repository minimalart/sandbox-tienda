import { Checkbox, Label, Text } from '@medusajs/ui';
import { useQuery } from '@tanstack/react-query';
import { registerSalesChannelMultiSelect } from '@minimalart/mercatto-plugin-runtime/admin';
import { sdk } from '../lib/client';

type Props = {
  /** Selected sales channel ids. */
  value: string[];
  onChange: (ids: string[]) => void;
  /** Optional label + help text (callers pass their own i18n strings). */
  label?: string;
  help?: string;
};

/**
 * Reusable sales-channel multi-select (checkbox list). Segments content by
 * sales channel — empty selection means "all channels". Mirrors the pattern
 * already used by the shop-by-look form; shared so banners/videos/brands/blog
 * stay consistent.
 */
export const SalesChannelMultiSelect = ({ value, onChange, label, help }: Props) => {
  const { data } = useQuery({
    queryKey: ['sc-multiselect', 'sales-channels'],
    queryFn: () => sdk.admin.salesChannel.list({ limit: 200, fields: 'id,name' }),
  });
  const channels = (data?.sales_channels ?? []) as { id: string; name: string }[];

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="flex flex-col gap-2">
      {label && <Label size="xsmall">{label}</Label>}
      {help && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {help}
        </Text>
      )}
      <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
        {channels.map((c) => (
          <label key={c.id} className="flex items-center gap-2">
            <Checkbox
              checked={value.includes(c.id)}
              onCheckedChange={() => toggle(c.id)}
            />
            <Text size="small">{c.name}</Text>
          </label>
        ))}
      </div>
    </div>
  );
};

// Registrar la implementación concreta en el runtime contract para que los
// plugins publicados que importan `<SalesChannelMultiSelect />` desde
// `@minimalart/mercatto-plugin-runtime/admin` la vean vía singleton compartido.
registerSalesChannelMultiSelect(SalesChannelMultiSelect);
