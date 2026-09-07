import {
  EllipsisHorizontal,
  InformationCircleSolid,
  PencilSquare,
  Trash,
} from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DropdownMenu,
  Heading,
  IconButton,
  Text,
  toast,
  useDataTable,
  usePrompt,
  type DataTablePaginationState,
} from '@medusajs/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Synonym } from '../../../../../modules/typesense/types';
import { SingleColumnLayout } from '../../../../components/layouts/single-column';
import { SafeHtml } from '../../../../lib/util/safe-html';
import { useSynonyms } from '../../hooks/useSynonyms';
import SynonymFormDrawer from './SynonymFormDrawer';

const columnHelper = createDataTableColumnHelper<Synonym>();

const Synonyms = () => {
  const { t } = useTranslation('typesense');
  const { synonyms, loading, error, success, createSynonym, updateSynonym, deleteSynonym } =
    useSynonyms();

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [searchValue, setSearchValue] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [editingData, setEditingData] = useState<Synonym | null>(null);

  const prompt = usePrompt();

  useEffect(() => {
    if (error) {
      toast.error(error, {
        description: <SafeHtml>{error}</SafeHtml>,
        duration: 5000,
        dismissable: true,
      });
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      toast.success(success, {
        description: <SafeHtml>{success}</SafeHtml>,
        duration: 5000,
        dismissable: true,
      });
    }
  }, [success]);

  const handleCreateSubmit = async (data: any) => {
    const confirmed = await prompt({
      title: t('CREATE_SYNONYM_TITLE'),
      description: t('CREATE_SYNONYM_DESCRIPTION'),
      variant: 'confirmation',
      confirmText: t('CREATE_SYNONYM_CONFIRM'),
      cancelText: t('CREATE_SYNONYM_CANCEL'),
    });

    if (confirmed) {
      try {
        await createSynonym(data);
        setIsCreateModalOpen(false);
      } catch (err) {
        // handled by hook
      }
    }
  };

  const handleEditSubmit = async (data: any) => {
    const confirmed = await prompt({
      title: t('EDIT_SYNONYM_TITLE'),
      description: t('EDIT_SYNONYM_DESCRIPTION'),
      variant: 'confirmation',
      confirmText: t('EDIT_SYNONYM_CONFIRM'),
      cancelText: t('EDIT_SYNONYM_CANCEL'),
    });

    if (confirmed && editingData) {
      try {
        await updateSynonym(editingData.id, data);
        setIsEditDrawerOpen(false);
        setEditingData(null);
      } catch (err) {
        // handled by hook
      }
    }
  };

  const handleDelete = async (synonymId: string) => {
    const confirmed = await prompt({
      title: t('DELETE_SYNONYM_TITLE'),
      description: t('DELETE_SYNONYM_DESCRIPTION').replace('{{id}}', synonymId),
      variant: 'danger',
      confirmText: t('DELETE_SYNONYM_CONFIRM'),
      cancelText: t('DELETE_SYNONYM_CANCEL'),
    });

    if (confirmed) {
      try {
        await deleteSynonym(synonymId);
      } catch (err) {
        // handled by hook
      }
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('id', {
        header: t('ID_HEADER'),
        cell: ({ getValue }) => <Text>{getValue()}</Text>,
      }),
      columnHelper.accessor('locale', {
        header: t('LANGUAGE_HEADER'),
        cell: ({ getValue }) => <Badge size="small">{getValue()?.toUpperCase() || 'GLOBAL'}</Badge>,
      }),
      columnHelper.accessor('root', {
        header: t('ROOT_TERM_HEADER'),
        cell: ({ getValue }) => <Text className="font-medium">{getValue() || '-'}</Text>,
      }),
      columnHelper.accessor('synonyms', {
        header: t('SYNONYMS_HEADER'),
        cell: ({ getValue }) => {
          const synonymsList = getValue() || [];
          if (synonymsList.length === 0) {
            return <Text className="text-ui-fg-subtle">-</Text>;
          }

          const measureText = (text: string) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) {
              return 0;
            }
            context.font = '14px Inter, sans-serif';
            return context.measureText(text).width;
          };

          const maxWidth = 320;
          let displayText = '';
          let hiddenCount = 0;
          let currentWidth = 0;

          for (let i = 0; i < synonymsList.length; i += 1) {
            const synonymWithComma =
              i === synonymsList.length - 1 ? synonymsList[i] : `${synonymsList[i]}, `;
            const textWidth = measureText(synonymWithComma);

            if (currentWidth + textWidth <= maxWidth) {
              displayText += synonymWithComma;
              currentWidth += textWidth;
            } else {
              hiddenCount = synonymsList.length - i;
              break;
            }
          }

          displayText = displayText.replace(/, $/, '');

          return (
            <div className="flex max-w-[350px] items-center gap-1 p-1">
              <Text className="truncate">
                {displayText}
                {hiddenCount > 0 ? <span className="ml-1">+ {hiddenCount}</span> : null}
              </Text>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: t('ACTIONS_HEADER'),
        cell: ({ row }) => {
          const synonym = row.original;
          return (
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <IconButton variant="transparent">
                  <EllipsisHorizontal />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item
                  onClick={() => {
                    setEditingData(synonym);
                    setIsEditDrawerOpen(true);
                  }}
                  className="gap-x-2"
                >
                  <PencilSquare className="text-ui-fg-subtle" />
                  {t('EDIT_ACTION')}
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item onClick={() => handleDelete(synonym.id)} className="gap-x-2">
                  <Trash className="text-ui-fg-subtle" />
                  {t('DELETE_ACTION')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          );
        },
      }),
    ],
    [t]
  );

  const table = useDataTable({
    columns,
    data: synonyms || [],
    getRowId: (row) => row.id,
    rowCount: synonyms?.length || 0,
    isLoading: loading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    search: {
      state: searchValue,
      onSearchChange: setSearchValue,
    },
  });

  return (
    <SingleColumnLayout>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between">
            <Heading level="h1">{t('SYNONYMS_TITLE')}</Heading>
            <Button variant="secondary" size="small" onClick={() => setIsCreateModalOpen(true)}>
              {t('CREATE_BUTTON')}
            </Button>
          </DataTable.Toolbar>
          {synonyms.length > 0 ? (
            <>
              <DataTable.Table />
              <DataTable.Pagination />
            </>
          ) : (
            <div className="flex items-center justify-center border-t p-5">
              <div className="flex flex-col items-center gap-y-2">
                <InformationCircleSolid />
                <Text>{t('SYNONYMS_NO_RECORDS_TITLE')}</Text>
                <Text className="text-ui-fg-subtle">{t('SYNONYMS_NO_RECORDS_DESCRIPTION')}</Text>
              </div>
            </div>
          )}
        </DataTable>
      </Container>

      <SynonymFormDrawer
        isOpen={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSubmit={handleCreateSubmit}
        editingData={undefined}
        loading={loading}
        title={t('CREATE_MODAL_TITLE')}
        submitText={t('CREATE_MODAL_SUBMIT')}
      />

      <SynonymFormDrawer
        isOpen={isEditDrawerOpen}
        onOpenChange={setIsEditDrawerOpen}
        onSubmit={handleEditSubmit}
        editingData={editingData || undefined}
        loading={loading}
        title={t('EDIT_MODAL_TITLE')}
        submitText={t('EDIT_MODAL_SUBMIT')}
      />
    </SingleColumnLayout>
  );
};

export default Synonyms;
