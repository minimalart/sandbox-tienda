import {
  ArchiveBox,
  EllipsisHorizontal,
  PencilSquare,
  Photo,
  SquareTwoStack,
  Trash,
} from '@medusajs/icons';
import {
  Badge,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  StatusBadge,
  Text,
  toast,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Banner } from '../../../hooks/api/banners';
import {
  useArchiveBanner,
  useCreateBanner,
  useDeleteBanner,
  usePublishBanner,
  useUnpublishBanner,
  useUpdateBanner,
} from '../../../hooks/api/banners';
import { isScheduled } from './placement-config';

function statusColor(status: string): 'green' | 'grey' | 'orange' | 'red' | 'blue' | 'purple' {
  switch (status) {
    case 'published':
      return 'green';
    case 'draft':
      return 'orange';
    case 'archived':
      return 'grey';
    default:
      return 'grey';
  }
}

/** Inline-editable priority, saved on blur/Enter via the existing update hook. */
const PriorityCell = ({ banner }: { banner: Banner }) => {
  const { t } = useTranslation('banners');
  const [priority, setPriority] = useState(String(banner.priority ?? 0));
  const { mutateAsync: updateBanner } = useUpdateBanner(banner.id);

  async function savePriority() {
    const next = Number(priority) || 0;
    if (next === (banner.priority ?? 0)) return;
    try {
      await updateBanner({ priority: next });
      toast.success(t('TOAST_PRIORITY_UPDATED'));
    } catch {
      setPriority(String(banner.priority ?? 0));
      toast.error(t('TOAST_SAVE_FAILED'));
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Input
        type="number"
        className="w-20"
        size="small"
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        onBlur={savePriority}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
};

const ActionsCell = ({ banner, onEdit }: { banner: Banner; onEdit: (b: Banner) => void }) => {
  const { t } = useTranslation('banners');

  const { mutateAsync: createBanner } = useCreateBanner();
  const { mutateAsync: deleteBanner } = useDeleteBanner();
  const { mutateAsync: publishBanner } = usePublishBanner();
  const { mutateAsync: unpublishBanner } = useUnpublishBanner();
  const { mutateAsync: archiveBanner } = useArchiveBanner();

  async function run(action: () => Promise<unknown>, okKey: string, failKey: string) {
    try {
      await action();
      toast.success(t(okKey));
    } catch {
      toast.error(t(failKey));
    }
  }

  async function handleDuplicate() {
    try {
      await createBanner({
        internal_name: `${banner.internal_name ?? banner.id} ${t('DUPLICATE_SUFFIX')}`,
        type: banner.type,
        device_type: banner.device_type,
        placement: banner.placement,
        status: 'draft',
        priority: banner.priority ?? 0,
        content: banner.content,
        media: banner.media,
        cta: banner.cta,
        metadata: banner.metadata,
        start_at: banner.start_at ?? null,
        end_at: banner.end_at ?? null,
      });
      toast.success(t('TOAST_DUPLICATED'));
    } catch {
      toast.error(t('TOAST_SAVE_FAILED'));
    }
  }

  async function handleDelete() {
    if (!confirm(t('CONFIRM_DELETE'))) return;
    await run(() => deleteBanner(banner.id), 'TOAST_DELETED', 'TOAST_DELETE_FAILED');
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <IconButton size="small" variant="transparent">
            <EllipsisHorizontal />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item className="gap-x-2" onClick={() => onEdit(banner)}>
            <PencilSquare className="text-ui-fg-subtle" />
            {t('ACTION_EDIT')}
          </DropdownMenu.Item>
          <DropdownMenu.Item className="gap-x-2" onClick={handleDuplicate}>
            <SquareTwoStack className="text-ui-fg-subtle" />
            {t('ACTION_DUPLICATE')}
          </DropdownMenu.Item>
          {banner.status !== 'published' && (
            <DropdownMenu.Item
              className="gap-x-2"
              onClick={() =>
                run(() => publishBanner(banner.id), 'TOAST_PUBLISHED', 'TOAST_PUBLISH_FAILED')
              }
            >
              <Photo className="text-ui-fg-subtle" />
              {t('ACTION_PUBLISH')}
            </DropdownMenu.Item>
          )}
          {banner.status === 'published' && (
            <DropdownMenu.Item
              className="gap-x-2"
              onClick={() =>
                run(() => unpublishBanner(banner.id), 'TOAST_UNPUBLISHED', 'TOAST_UNPUBLISH_FAILED')
              }
            >
              <EllipsisHorizontal className="text-ui-fg-subtle" />
              {t('ACTION_UNPUBLISH')}
            </DropdownMenu.Item>
          )}
          {banner.status !== 'archived' && (
            <DropdownMenu.Item
              className="gap-x-2"
              onClick={() =>
                run(() => archiveBanner(banner.id), 'TOAST_ARCHIVED', 'TOAST_ARCHIVE_FAILED')
              }
            >
              <ArchiveBox className="text-ui-fg-subtle" />
              {t('ACTION_ARCHIVE')}
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator />
          <DropdownMenu.Item className="gap-x-2" onClick={handleDelete}>
            <Trash className="text-ui-fg-subtle" />
            {t('ACTION_DELETE')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
};

const columnHelper = createDataTableColumnHelper<Banner>();

type Props = {
  titleKey: string;
  items: Banner[];
  onEdit: (banner: Banner) => void;
};

/**
 * Standard admin table (DataTable pattern) for the items of one state group
 * inside a placement editor. Small lists — no pagination needed.
 */
export function PlacementItemsTable({ titleKey, items, onEdit }: Props) {
  const { t } = useTranslation('banners');

  const columns = useMemo(
    () => [
      columnHelper.accessor('internal_name', {
        header: t('COL_INTERNAL_NAME'),
        cell: ({ row }) => {
          const banner = row.original;
          const snippet =
            banner.content?.title || banner.content?.body || banner.content?.subtitle;
          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <Text size="small" weight="plus" className="truncate">
                {banner.internal_name || '—'}
              </Text>
              {snippet ? (
                <Text size="xsmall" className="truncate text-ui-fg-subtle">
                  {snippet}
                </Text>
              ) : null}
            </div>
          );
        },
      }),
      columnHelper.accessor('device_type', {
        header: t('COL_DEVICE'),
        cell: ({ getValue }) => (
          <Badge size="2xsmall">{t(`DEVICE_${(getValue() || 'all').toUpperCase()}`)}</Badge>
        ),
      }),
      columnHelper.accessor('priority', {
        header: t('COL_PRIORITY'),
        cell: ({ row }) => <PriorityCell banner={row.original} />,
      }),
      columnHelper.accessor('status', {
        header: t('COL_STATUS'),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <StatusBadge color={statusColor(row.original.status)}>
              {t(`STATUS_${row.original.status.toUpperCase()}`)}
            </StatusBadge>
            {isScheduled(row.original) ? (
              <Badge size="2xsmall" color="blue">
                {t('GROUP_SCHEDULED')}
              </Badge>
            ) : null}
          </div>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => <ActionsCell banner={row.original} onEdit={onEdit} />,
      }),
    ],
    [t, onEdit]
  );

  const table = useDataTable({
    columns,
    data: items,
    getRowId: (row) => row.id,
    rowCount: items.length,
    // Medusa's DataTable passes the TanStack row wrapper at runtime (aunque el
    // tipo diga que es la fila de datos). El form de edición lee los campos del
    // banner directamente, así que hay que desenvolver `.original`; si no, abre
    // vacío como si fuera "crear".
    onRowClick: (_event, row) =>
      onEdit((row as unknown as { original?: Banner }).original ?? (row as Banner)),
  });

  if (items.length === 0) return null;

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">
            {t(titleKey)} ({items.length})
          </Heading>
        </DataTable.Toolbar>
        <DataTable.Table />
      </DataTable>
    </Container>
  );
}
