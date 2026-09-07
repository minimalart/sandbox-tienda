import {
  EllipsisHorizontal,
  InformationCircleSolid,
  PencilSquare,
  Trash,
} from '@medusajs/icons';
import {
  Button,
  Container,
  DataTable,
  DropdownMenu,
  Heading,
  IconButton,
  Text,
  createDataTableColumnHelper,
  toast,
  useDataTable,
  usePrompt,
  type DataTablePaginationState,
} from '@medusajs/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Override } from '../../../../../modules/typesense/types';
import { SingleColumnLayout } from '../../../../components/layouts/single-column';
import { SafeHtml } from '../../../../lib/util/safe-html';
import { useCurationForm, type CurationFormResult } from '../../hooks/useCurationForm';
import { useCurationsData } from '../../hooks/useCurationsData';
import CurationFormDrawer from './forms/CurationFormDrawer';

const columnHelper = createDataTableColumnHelper<Override>();

const Curations = () => {
  const { t } = useTranslation('typesense');
  const { overrides, loading, error, success, upsertOverride, deleteOverride, getOverride } =
    useCurationsData();

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const prompt = usePrompt();

  const handleCreateSubmit = useCallback(
    async (data: CurationFormResult) => {
      const confirmed = await prompt({
        title: t('CREATE_CURATION_TITLE'),
        description: t('CREATE_CURATION_DESCRIPTION'),
        variant: 'confirmation',
        confirmText: t('CREATE_CURATION_CONFIRM'),
        cancelText: t('CREATE_CURATION_CANCEL'),
      });

      if (!confirmed) {
        return;
      }

      const result = await upsertOverride(data.sanitizedId, data.overrideData, false);
      if (result) {
        setIsModalOpen(false);
        setEditingId(null);
      }
    },
    [prompt, t, upsertOverride]
  );

  const handleEditSubmit = useCallback(
    async (data: CurationFormResult) => {
      if (!editingId) {
        return;
      }

      const confirmed = await prompt({
        title: t('EDIT_CURATION_TITLE'),
        description: t('EDIT_CURATION_DESCRIPTION'),
        variant: 'confirmation',
        confirmText: t('EDIT_CURATION_CONFIRM'),
        cancelText: t('EDIT_CURATION_CANCEL'),
      });

      if (!confirmed) {
        return;
      }

      const result = await upsertOverride(editingId, data.overrideData, true);
      if (result) {
        setIsModalOpen(false);
        setEditingId(null);
      }
    },
    [editingId, prompt, t, upsertOverride]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = await prompt({
        title: t('DELETE_CURATION_TITLE'),
        description: t('DELETE_CURATION_DESCRIPTION'),
        variant: 'danger',
        confirmText: t('DELETE_CURATION_CONFIRM'),
        cancelText: t('DELETE_CURATION_CANCEL'),
      });

      if (!confirmed) {
        return;
      }

      await deleteOverride(id);
    },
    [deleteOverride, prompt, t]
  );

  const formHook = useCurationForm(async (result) => {
    if (editingId) {
      await handleEditSubmit(result);
    } else {
      await handleCreateSubmit(result);
    }
  });

  const handleEdit = useCallback(
    async (id: string) => {
      try {
        const override = await getOverride(id);
        if (override) {
          setEditingId(id);
          formHook.loadOverrideForEdit(override);
          setIsModalOpen(true);
        }
      } catch (err) {
        console.error('Failed to load curation', err);
      }
    },
    [formHook, getOverride]
  );

  useEffect(() => {
    if (error) {
      toast.error(t('TOAST_TITLE'), {
        description: <SafeHtml>{error}</SafeHtml>,
        dismissable: true,
        duration: 5000,
      });
    }
  }, [error, t]);

  useEffect(() => {
    if (success) {
      toast.success(t('TOAST_TITLE'), {
        description: <SafeHtml>{success}</SafeHtml>,
        dismissable: true,
        duration: 5000,
      });
    }
  }, [success, t]);

  const handleNewCuration = () => {
    setEditingId(null);
    formHook.reset();
    setIsModalOpen(true);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('id', {
        header: t('ID_HEADER'),
        cell: ({ getValue }) => <Text>{getValue()}</Text>,
      }),
      columnHelper.accessor('rule', {
        header: t('QUERY_FILTER_HEADER'),
        cell: ({ getValue }) => {
          const rule = getValue();
          const segments: string[] = [];
          if (rule?.query) {
            segments.push(`${t('QUERY_LABEL_SHORT')}: ${rule.query}`);
          }
          if (rule?.filter_by) {
            segments.push(`${t('FILTER_LABEL_SHORT')}: ${rule.filter_by}`);
          }
          if (rule?.tags?.length) {
            segments.push(`${t('TAGS_LABEL_SHORT')}: ${rule.tags.join(', ')}`);
          }
          return <Text>{segments.length > 0 ? segments.join(' | ') : '-'}</Text>;
        },
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
              <DropdownMenu.Item onClick={() => handleEdit(row.original.id)} className="gap-x-2">
                <PencilSquare className="text-ui-fg-subtle" />
                {t('EDIT_ACTION')}
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item onClick={() => handleDelete(row.original.id)} className="gap-x-2">
                <Trash className="text-ui-fg-subtle" />
                {t('DELETE_ACTION')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        ),
      }),
    ],
    [handleDelete, handleEdit, t]
  );

  const table = useDataTable({
    columns,
    data: overrides || [],
    getRowId: (row) => row.id,
    rowCount: overrides?.length || 0,
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
            <Heading level="h1">{t('CURATIONS_TITLE')}</Heading>
            <Button variant="secondary" size="small" onClick={handleNewCuration}>
              {t('CREATE_BUTTON')}
            </Button>
          </DataTable.Toolbar>
          {overrides && overrides.length > 0 ? (
            <>
              <DataTable.Table />
              <DataTable.Pagination />
            </>
          ) : (
            <div className="flex items-center justify-center border-t p-5">
              <div className="flex flex-col items-center gap-y-2">
                <InformationCircleSolid />
                <Text>{t('CURATIONS_NO_RECORDS_TITLE')}</Text>
                <Text className="text-ui-fg-subtle">{t('CURATIONS_NO_RECORDS_DESCRIPTION')}</Text>
              </div>
            </div>
          )}
        </DataTable>
      </Container>

      <CurationFormDrawer
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        editingId={editingId}
        loading={loading}
        formHook={formHook}
      />
    </SingleColumnLayout>
  );
};

export default Curations;
