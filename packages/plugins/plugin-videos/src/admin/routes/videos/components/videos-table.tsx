import { ArrowPath, EllipsisHorizontal, PencilSquare, Trash } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  DropdownMenu,
  Heading,
  IconButton,
  StatusBadge,
  Text,
  useDataTable,
  usePrompt,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeleteVideo, useSyncVideo, useVideos } from '../../../hooks/api/videos';
import { registerVideosTranslations } from '../../../translations/videos';
import { CreateVideoDrawer } from './create-video-drawer';
import { EditVideoDrawer } from './edit-video-drawer';
// Nota: en la extensión in-tree acá había un `<ExtensionVersion />` que leía la
// versión de `mercatto-component.json`. Ese componente vive en el host
// (`apps/backend/src/admin/components/common/`) y no cruza el límite del
// plugin publicado. Se reemplaza por un `<Badge>` estático con la versión
// declarada en `mercatto-plugin.json` — mismo patrón que `plugin-ga4`.
const PLUGIN_VERSION = '1.2.0';

const PAGE_SIZE = 20;

type VideoRow = Record<string, unknown> & { id: string };

const columnHelper = createDataTableColumnHelper<VideoRow>();

const getStatusColor = (status: string) => {
  switch (status) {
    case 'available':
      return 'green';
    case 'processing':
    case 'transcoding':
      return 'blue';
    case 'uploading':
      return 'orange';
    case 'error':
      return 'red';
    default:
      return 'grey';
  }
};

const formatDuration = (seconds?: number) => {
  if (!seconds) return '-';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const VideosTable = () => {
  const { t, i18n } = useTranslation('videos');
  registerVideosTranslations(i18n);
  const prompt = usePrompt();

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [editVideoId, setEditVideoId] = useState<string | null>(null);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isLoading, refetch } = useVideos({ offset, limit: pagination.pageSize });
  const deleteMutation = useDeleteVideo();
  const syncMutation = useSyncVideo();

  const videos = (data?.videos || []) as VideoRow[];
  const count = data?.count || 0;

  const handleDelete = async (id: string) => {
    const confirmed = await prompt({
      title: t('DELETE_TITLE'),
      description: t('DELETE_CONFIRM'),
      variant: 'danger',
      confirmText: t('DELETE_ACTION'),
      cancelText: t('CANCEL'),
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(id);
      await refetch();
    } catch (error) {
      console.error('[VideosTable] Delete failed:', error);
    }
  };

  const handleSync = async (id: string) => {
    try {
      await syncMutation.mutateAsync(id);
      await refetch();
    } catch (error) {
      console.error('[VideosTable] Sync failed:', error);
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: t('TABLE_COL_VIDEO'),
        cell: ({ row }) => {
          const video = row.original;
          return (
            <div className="flex items-center gap-3">
              {video.thumbnail_url ? (
                <img
                  src={video.thumbnail_url as string}
                  alt={video.title as string}
                  className="w-16 h-10 object-cover rounded"
                />
              ) : (
                <div className="w-16 h-10 bg-ui-bg-subtle rounded flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-ui-fg-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
              <div>
                <Text className="font-medium">{video.title as string}</Text>
                {video.description ? (
                  <Text className="text-xs text-ui-fg-subtle line-clamp-1">
                    {video.description as string}
                  </Text>
                ) : null}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('status', {
        header: t('TABLE_COL_STATUS'),
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return (
            <StatusBadge color={getStatusColor(status)}>
              {t(`STATUS_${(status || 'unknown').toUpperCase()}`, { defaultValue: status })}
            </StatusBadge>
          );
        },
      }),
      columnHelper.accessor('duration', {
        header: t('TABLE_COL_DURATION'),
        cell: ({ getValue }) => (
          <Text className="text-sm">{formatDuration(getValue() as number)}</Text>
        ),
      }),
      columnHelper.accessor('is_active', {
        header: t('TABLE_COL_ACTIVE'),
        cell: ({ getValue }) => (
          <StatusBadge color={getValue() ? 'green' : 'grey'}>
            {getValue() ? t('YES') : t('NO')}
          </StatusBadge>
        ),
      }),
      columnHelper.accessor('sort_order', {
        header: t('TABLE_COL_SORT_ORDER'),
        cell: ({ getValue }) => <Text className="text-sm">{getValue() as number}</Text>,
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const video = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <IconButton size="small" variant="transparent">
                    <EllipsisHorizontal />
                  </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Item
                    className="gap-x-2"
                    onClick={() => setEditVideoId(video.id)}
                  >
                    <PencilSquare className="text-ui-fg-subtle" />
                    {t('EDIT_VIDEO')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="gap-x-2"
                    onClick={() => handleSync(video.id)}
                    disabled={syncMutation.isPending}
                  >
                    <ArrowPath className="text-ui-fg-subtle" />
                    {t('SYNC_FROM_VIMEO')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    className="gap-x-2"
                    onClick={() => handleDelete(video.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash className="text-ui-fg-subtle" />
                    {t('DELETE_ACTION')}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            </div>
          );
        },
      }),
    ],
    [t, deleteMutation.isPending, syncMutation.isPending]
  );

  const table = useDataTable({
    columns,
    data: videos,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    onRowClick: (_event, row) => setEditVideoId(row.id),
  });

  return (
    <>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-x-2">
              <Heading>{t('TITLE')}</Heading>
              <Badge size="2xsmall">v{PLUGIN_VERSION}</Badge>
            </div>
            <Button variant="secondary" size="small" onClick={() => setIsCreateDrawerOpen(true)}>
              {t('CREATE_BUTTON')}
            </Button>
          </DataTable.Toolbar>
          {count > 0 || isLoading ? (
            <>
              <DataTable.Table />
              <DataTable.Pagination />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 border-t py-12">
              <Text className="text-ui-fg-subtle">{t('TABLE_EMPTY_TITLE')}</Text>
              <Text className="text-sm text-ui-fg-muted">{t('TABLE_EMPTY_SUBTITLE')}</Text>
            </div>
          )}
        </DataTable>
      </Container>

      <CreateVideoDrawer open={isCreateDrawerOpen} onClose={() => setIsCreateDrawerOpen(false)} />

      <EditVideoDrawer
        videoId={editVideoId}
        open={!!editVideoId}
        onClose={() => setEditVideoId(null)}
      />
    </>
  );
};
