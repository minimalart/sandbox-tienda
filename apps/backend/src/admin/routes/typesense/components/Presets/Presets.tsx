import { EllipsisHorizontal, InformationCircleSolid, PencilSquare, Trash } from '@medusajs/icons';
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
  Text,
  toast,
  useDataTable,
  usePrompt,
} from '@medusajs/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SearchPreset, SearchPresetFieldRow } from '../../../../../modules/typesense/types';
import { SingleColumnLayout } from '../../../../components/layouts/single-column';
import { usePresets } from '../../hooks/usePresets';
import PresetFormDrawer from './PresetFormDrawer';

const columnHelper = createDataTableColumnHelper<SearchPreset>();

const getFieldsSummary = (preset: SearchPreset): string => {
  if (!preset.value.query_by) return '—';
  const fields = String(preset.value.query_by).split(',');
  if (fields.length <= 3) return fields.join(', ');
  return `${fields.slice(0, 3).join(', ')} +${fields.length - 3}`;
};

const Presets = () => {
  const { t } = useTranslation('typesense');
  const dialog = usePrompt();
  const { presets, loading, error, upsertPreset, deletePreset } = usePresets();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<SearchPreset | null>(null);
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleNewPreset = () => {
    setEditingPreset(null);
    setDrawerOpen(true);
  };

  const handleEditPreset = (preset: SearchPreset) => {
    setEditingPreset(preset);
    setDrawerOpen(true);
  };

  const handleDeletePreset = async (preset: SearchPreset) => {
    const confirmed = await dialog({
      title: t('DELETE_PRESET_TITLE'),
      description: t('DELETE_PRESET_DESCRIPTION', { name: preset.name }),
      confirmText: t('DELETE_PRESET_CONFIRM'),
      cancelText: t('DELETE_PRESET_CANCEL'),
    });

    if (!confirmed) return;

    try {
      await deletePreset(preset.name);
      toast.success(t('DELETE_PRESET_SUCCESS'));
    } catch {
      toast.error('Failed to delete preset');
    }
  };

  const handleFormSubmit = async (
    name: string,
    fields: SearchPresetFieldRow[],
    sortBy: string,
    numTypos: number,
    prefix: boolean
  ) => {
    const enabledFields = fields.filter((f) => f.enabled);
    const query_by = enabledFields.map((f) => f.field).join(',');
    const query_by_weights = enabledFields.map((f) => f.weight).join(',');

    const value: Record<string, unknown> = { query_by, query_by_weights };
    if (sortBy.trim()) value.sort_by = sortBy.trim();
    if (numTypos !== undefined) value.num_typos = numTypos;
    value.prefix = prefix;

    try {
      await upsertPreset(name, value, Boolean(editingPreset));
      toast.success(editingPreset ? t('UPDATE_PRESET_SUCCESS') : t('CREATE_PRESET_SUCCESS'));
      setDrawerOpen(false);
    } catch {
      toast.error('Failed to save preset');
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('PRESET_NAME_HEADER'),
        cell: ({ row }) => (
          <div className="flex items-center gap-x-2">
            <code className="rounded bg-ui-bg-highlight px-1.5 py-0.5 text-xs font-mono text-ui-fg-base">
              {row.original.name}
            </code>
            {row.original.name === 'storefront-default' ? (
              <Badge size="xsmall" color="green">
                default
              </Badge>
            ) : null}
          </div>
        ),
      }),
      columnHelper.display({
        id: 'fields',
        header: t('PRESET_FIELDS_HEADER'),
        cell: ({ row }) => (
          <Text className="text-xs text-ui-fg-subtle font-mono">{getFieldsSummary(row.original)}</Text>
        ),
      }),
      columnHelper.display({
        id: 'sort_by',
        header: t('PRESET_SORT_HEADER'),
        cell: ({ row }) => (
          <Text className="text-xs text-ui-fg-subtle font-mono">
            {row.original.value.sort_by ? String(row.original.value.sort_by) : '—'}
          </Text>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: t('ACTIONS_HEADER'),
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <IconButton variant="transparent">
                <EllipsisHorizontal />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item onClick={() => handleEditPreset(row.original)} className="gap-x-2">
                <PencilSquare className="text-ui-fg-subtle" />
                {t('EDIT_ACTION')}
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                onClick={() => handleDeletePreset(row.original)}
                className="gap-x-2"
              >
                <Trash className="text-ui-fg-subtle" />
                {t('DELETE_ACTION')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        ),
      }),
    ],
    [t]
  );

  const table = useDataTable({
    columns,
    data: presets || [],
    getRowId: (row) => row.name,
    rowCount: presets?.length || 0,
    isLoading: loading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  });

  return (
    <SingleColumnLayout>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between">
            <Heading level="h1">{t('PRESETS_TITLE')}</Heading>
            <Button variant="secondary" size="small" onClick={handleNewPreset} disabled={loading}>
              {t('CREATE_BUTTON')}
            </Button>
          </DataTable.Toolbar>
          {presets.length > 0 ? (
            <>
              <DataTable.Table />
              <DataTable.Pagination />
            </>
          ) : (
            <div className="flex items-center justify-center border-t p-5">
              <div className="flex flex-col items-center gap-y-2">
                <InformationCircleSolid />
                <Text>{t('PRESETS_NO_RECORDS_TITLE')}</Text>
                <Text className="text-ui-fg-subtle">{t('PRESETS_NO_RECORDS_DESCRIPTION')}</Text>
              </div>
            </div>
          )}
        </DataTable>
      </Container>

      <PresetFormDrawer
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSubmit={handleFormSubmit}
        editingPreset={editingPreset}
        loading={loading}
      />
    </SingleColumnLayout>
  );
};

export default Presets;
