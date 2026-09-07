import { Checkbox, Label, Text } from '@medusajs/ui';
import { useQuery } from '@tanstack/react-query';

/**
 * Vendored copy of the host's `SalesChannelMultiSelect` component. In the base
 * extension it was imported from `apps/backend/src/admin/components/`; that
 * path is not reachable from a published plugin, so we ship a self-contained
 * version here. The host's `sdk.admin.salesChannel.list` call is replaced with
 * a plain `fetch` to `/admin/sales-channels` (same-origin, cookies-based
 * session — the admin runs on the same origin as the backend).
 */
type Props = {
  /** Selected sales channel ids. */
  value: string[];
  onChange: (ids: string[]) => void;
  /** Optional label + help text (callers pass their own i18n strings). */
  label?: string;
  help?: string;
};

type SalesChannel = { id: string; name: string };

async function fetchSalesChannels(): Promise<SalesChannel[]> {
  const params = new URLSearchParams({
    limit: '200',
    fields: 'id,name',
  });
  const res = await fetch(`/admin/sales-channels?${params.toString()}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { sales_channels?: SalesChannel[] };
  return data?.sales_channels ?? [];
}

export const SalesChannelMultiSelect = ({ value, onChange, label, help }: Props) => {
  const { data } = useQuery({
    queryKey: ['plugin-videos', 'sales-channels'],
    queryFn: fetchSalesChannels,
  });
  const channels = data ?? [];

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
