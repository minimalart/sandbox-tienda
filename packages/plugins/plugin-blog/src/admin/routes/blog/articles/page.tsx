import { defineRouteConfig } from '@medusajs/admin-sdk';
import { DocumentText, EllipsisHorizontal, PencilSquare, SquareTwoStack, Trash } from '@medusajs/icons';
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DropdownMenu,
  Heading,
  IconButton,
  StatusBadge,
  Text,
  Toaster,
  toast,
  useDataTable,
  usePrompt,
  type DataTablePaginationState,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  useBlogPosts,
  useBlogCategories,
  useDeleteBlogPost,
  useDuplicateBlogPost,
  usePublishBlogPost,
  useUnpublishBlogPost,
  type BlogPost,
} from '../../../hooks/api/blog';
import { registerBlogTranslations } from '../../../translations/blog';
import { ExtensionVersion, SiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';

const PAGE_SIZE = 20;
const columnHelper = createDataTableColumnHelper<BlogPost>();

const ArticlesPage = () => {
  const { t, i18n } = useTranslation('blog');
  registerBlogTranslations(i18n);
  const navigate = useNavigate();
  const prompt = usePrompt();

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useBlogPosts({
    limit: pagination.pageSize,
    offset,
  });
  const { data: catData } = useBlogCategories({ limit: 200 });

  const categoryName = useMemo(() => {
    const map = new Map<string, string>();
    (catData?.blog_categories ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [catData]);

  const deleteMut = useDeleteBlogPost();
  const duplicateMut = useDuplicateBlogPost();
  const publishMut = usePublishBlogPost();
  const unpublishMut = useUnpublishBlogPost();

  const handleDelete = async (post: BlogPost) => {
    const confirmed = await prompt({
      title: t('CONFIRM_DELETE_TITLE'),
      description: t('CONFIRM_DELETE_DESC'),
      confirmText: t('ACTION_DELETE'),
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    await deleteMut.mutateAsync(post.id);
    toast.success(t('ACTION_DELETE'));
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: t('COLUMN_TITLE'),
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue()}</span>
        ),
      }),
      columnHelper.accessor('category_id', {
        header: t('COLUMN_CATEGORY'),
        cell: ({ getValue }) => {
          const id = getValue();
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {id ? categoryName.get(id) ?? '—' : '—'}
            </Text>
          );
        },
      }),
      columnHelper.accessor('status', {
        header: t('COLUMN_STATUS'),
        cell: ({ getValue }) => {
          const published = getValue() === 'published';
          return (
            <StatusBadge color={published ? 'green' : 'grey'}>
              {published ? t('STATUS_PUBLISHED') : t('STATUS_DRAFT')}
            </StatusBadge>
          );
        },
      }),
      columnHelper.accessor('published_at', {
        header: t('COLUMN_DATE'),
        cell: ({ row }) => {
          const d = row.original.published_at ?? row.original.created_at;
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {d ? new Date(d).toLocaleDateString() : '—'}
            </Text>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const post = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <IconButton variant="transparent" size="small">
                    <EllipsisHorizontal />
                  </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Item
                    onClick={() => navigate(`/blog/articles/${post.id}`)}
                  >
                    <PencilSquare className="mr-2" />
                    {t('ACTION_EDIT')}
                  </DropdownMenu.Item>
                  {post.status === 'published' ? (
                    <DropdownMenu.Item
                      onClick={() => unpublishMut.mutate(post.id)}
                    >
                      {t('ACTION_UNPUBLISH')}
                    </DropdownMenu.Item>
                  ) : (
                    <DropdownMenu.Item
                      onClick={() => publishMut.mutate(post.id)}
                    >
                      {t('ACTION_PUBLISH')}
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Item
                    onClick={() => duplicateMut.mutate(post.id)}
                  >
                    <SquareTwoStack className="mr-2" />
                    {t('ACTION_DUPLICATE')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item onClick={() => handleDelete(post)}>
                    <Trash className="mr-2" />
                    {t('ACTION_DELETE')}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            </div>
          );
        },
      }),
    ],
    [t, categoryName],
  );

  const posts = data?.blog_posts ?? [];
  const count = data?.count ?? 0;

  const table = useDataTable({
    columns,
    data: posts,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_e, row) => navigate(`/blog/articles/${row.id}`),
  });

  return (
    <>
        <SiteScopeBar screen="blog" />
        <Container className="p-0">
          <DataTable instance={table}>
            <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-x-2">
                <Heading>{t('ARTICLES_TITLE')}</Heading>
                <ExtensionVersion extension="blog" />
              </div>
              <Button
                size="small"
                variant="secondary"
                onClick={() => navigate('/blog/articles/new')}
              >
                {t('CREATE_ARTICLE')}
              </Button>
            </DataTable.Toolbar>
            {count > 0 || isPending ? (
              <>
                <DataTable.Table />
                <DataTable.Pagination />
              </>
            ) : (
              <div className="flex items-center justify-center border-t p-6 text-center">
                <Text className="text-ui-fg-subtle">{t('ARTICLES_EMPTY')}</Text>
              </div>
            )}
          </DataTable>
          <Toaster />
        </Container>
    </>
  );
};

const ArticlesIcon = () => <DocumentText />;

export const config = defineRouteConfig({
  label: 'Artículos',
  icon: ArticlesIcon,
});

export default ArticlesPage;
