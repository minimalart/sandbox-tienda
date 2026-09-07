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

import type { StopWord, StopWordFormData } from '../../../../../modules/typesense/types';
import { SingleColumnLayout } from '../../../../components/layouts/single-column';
import { SafeHtml } from '../../../../lib/util/safe-html';
import { useStopWords } from '../../hooks/useStopWords';
import StopWordFormDrawer from './StopWordFormDrawer';

const columnHelper = createDataTableColumnHelper<StopWord>();

const StopWords = () => {
  const { t } = useTranslation('typesense');
  const {
    stopWords,
    loading,
    error,
    success,
    createStopWord,
    updateStopWord,
    deleteStopWord,
    clearMessages,
  } = useStopWords();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [editingData, setEditingData] = useState<StopWord | null>(null);
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const prompt = usePrompt();

  useEffect(() => {
    if (success) {
      toast.success(t('TOAST_TITLE'), {
        description: <SafeHtml>{success}</SafeHtml>,
      });
    }
  }, [success, t]);

  useEffect(() => {
    if (error) {
      toast.error(t('TOAST_TITLE'), {
        description: <SafeHtml>{error}</SafeHtml>,
      });
    }
  }, [error, t]);

  const handleCreateSubmit = async (data: StopWordFormData) => {
    const confirmed = await prompt({
      title: t('CREATE_STOPWORDS_TITLE'),
      description: t('CREATE_STOPWORDS_DESCRIPTION'),
      variant: 'confirmation',
      confirmText: t('CREATE_STOPWORDS_CONFIRM'),
      cancelText: t('CREATE_STOPWORDS_CANCEL'),
    });

    if (confirmed) {
      await createStopWord(data);
      setIsCreateModalOpen(false);
    }
  };

  const handleEditSubmit = async (data: StopWordFormData) => {
    const confirmed = await prompt({
      title: t('EDIT_STOPWORDS_TITLE'),
      description: t('EDIT_STOPWORDS_DESCRIPTION'),
      variant: 'confirmation',
      confirmText: t('EDIT_STOPWORDS_CONFIRM'),
      cancelText: t('EDIT_STOPWORDS_CANCEL'),
    });

    if (confirmed && editingData) {
      await updateStopWord(editingData.id, data);
      setIsEditDrawerOpen(false);
      setEditingData(null);
    }
  };

  const handleDelete = async (stopWordList: StopWord) => {
    const confirmed = await prompt({
      title: t('DELETE_STOPWORDS_TITLE'),
      description: t('DELETE_STOPWORDS_DESCRIPTION').replace('{{id}}', stopWordList.id),
      variant: 'danger',
      confirmText: t('DELETE_STOPWORDS_CONFIRM'),
      cancelText: t('DELETE_STOPWORDS_CANCEL'),
    });

    if (confirmed) {
      await deleteStopWord(stopWordList.id);
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
        cell: ({ getValue }) => <Badge size="small">{getValue()?.toUpperCase() || 'ES'}</Badge>,
      }),
      columnHelper.accessor('stopwords', {
        id: 'preview',
        header: t('STOPWORDS_PREVIEW_HEADER'),
        cell: ({ getValue }) => {
          const stopwordList = getValue() ?? [];
          if (stopwordList.length === 0) {
            return <Text className="text-ui-fg-subtle">-</Text>;
          }

          const measureText = (text: string) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            return context ? context.measureText(text).width : 0;
          };

          const maxWidth = 320;
          let displayText = '';
          let hiddenCount = 0;
          let currentWidth = 0;

          for (let i = 0; i < stopwordList.length; i += 1) {
            const wordWithComma =
              i === stopwordList.length - 1 ? stopwordList[i] : `${stopwordList[i]}, `;
            const textWidth = measureText(wordWithComma);

            if (currentWidth + textWidth <= maxWidth) {
              displayText += wordWithComma;
              currentWidth += textWidth;
            } else {
              hiddenCount = stopwordList.length - i;
              break;
            }
          }

          displayText = displayText.replace(/, $/, '');

          return (
            <div className="flex max-w-[350px] items-center gap-1 p-1">
              <Text className="truncate">
                {displayText}
                {hiddenCount > 0 ? (
                  <span className="ml-1 text-ui-fg-subtle font-medium">+ {hiddenCount}</span>
                ) : null}
              </Text>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: t('ACTIONS_HEADER'),
        cell: ({ row }) => {
          const stopWordList = row.original;
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
                    setEditingData(stopWordList);
                    setIsEditDrawerOpen(true);
                    clearMessages();
                  }}
                  className="gap-x-2"
                >
                  <PencilSquare className="text-ui-fg-subtle" />
                  {t('EDIT_ACTION')}
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item onClick={() => handleDelete(stopWordList)} className="gap-x-2">
                  <Trash className="text-ui-fg-subtle" />
                  {t('DELETE_ACTION')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          );
        },
      }),
    ],
    [clearMessages, t]
  );

  const table = useDataTable({
    data: stopWords || [],
    columns,
    getRowId: (row) => row.id,
    rowCount: stopWords?.length || 0,
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
            <Heading level="h1">{t('STOPWORDS_TITLE')}</Heading>
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                setIsCreateModalOpen(true);
                setEditingData(null);
                clearMessages();
              }}
            >
              {t('CREATE_BUTTON')}
            </Button>
          </DataTable.Toolbar>
          {stopWords && stopWords.length > 0 ? (
            <>
              <DataTable.Table />
              <DataTable.Pagination />
            </>
          ) : (
            <div className="flex items-center justify-center border-t p-5">
              <div className="flex flex-col items-center gap-y-2">
                <InformationCircleSolid />
                <Text>{t('STOPWORDS_NO_RECORDS_TITLE')}</Text>
                <Text className="text-ui-fg-subtle">{t('STOPWORDS_NO_RECORDS_DESCRIPTION')}</Text>
              </div>
            </div>
          )}
        </DataTable>
      </Container>

      <StopWordFormDrawer
        isOpen={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSubmit={handleCreateSubmit}
        editingData={null}
        loading={loading}
        title={t('CREATE_STOPWORDS_MODAL_TITLE')}
        submitText={t('CREATE_BUTTON')}
      />

      <StopWordFormDrawer
        isOpen={isEditDrawerOpen}
        onOpenChange={setIsEditDrawerOpen}
        onSubmit={handleEditSubmit}
        editingData={editingData}
        loading={loading}
        title={t('EDIT_STOPWORDS_MODAL_TITLE')}
        submitText={t('UPDATE_BUTTON')}
      />
    </SingleColumnLayout>
  );
};

export default StopWords;
