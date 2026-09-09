import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Tag, EllipsisHorizontal, PencilSquare, Trash } from '@medusajs/icons';
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  Label,
  Text,
  Textarea,
  Toaster,
  toast,
  useDataTable,
  usePrompt,
} from '@medusajs/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useBlogCategories,
  useCreateBlogCategory,
  useUpdateBlogCategory,
  useDeleteBlogCategory,
  type BlogCategory,
  type BlogImage,
} from '../../../hooks/api/blog';
import { registerBlogTranslations } from '../../../translations/blog';
import { sdk } from '../../../lib/client';

const columnHelper = createDataTableColumnHelper<BlogCategory>();

const CategoriesPage = () => {
  const { t, i18n } = useTranslation('blog');
  registerBlogTranslations(i18n);
  const prompt = usePrompt();

  const { data, isPending } = useBlogCategories({ limit: 200 });
  const deleteMut = useDeleteBlogCategory();

  const [editing, setEditing] = useState<BlogCategory | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleDelete = async (cat: BlogCategory) => {
    const ok = await prompt({
      title: t('CONFIRM_DELETE_TITLE'),
      description: t('CONFIRM_DELETE_DESC'),
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (!ok) return;
    await deleteMut.mutateAsync(cat.id);
    toast.success(t('CATEGORY_DELETED'));
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('FIELD_NAME'),
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      columnHelper.accessor('slug', {
        header: t('FIELD_SLUG'),
        cell: ({ getValue }) => (
          <Text size="small" className="text-ui-fg-subtle">{getValue()}</Text>
        ),
      }),
      columnHelper.accessor('sort_order', {
        header: t('FIELD_ORDER'),
        cell: ({ getValue }) => (
          <Text size="small" className="text-ui-fg-subtle">{getValue()}</Text>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <IconButton variant="transparent" size="small">
                  <EllipsisHorizontal />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item onClick={() => setEditing(row.original)}>
                  <PencilSquare className="mr-2" />
                  {t('ACTION_EDIT')}
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item onClick={() => handleDelete(row.original)}>
                  <Trash className="mr-2" />
                  {t('ACTION_DELETE')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        ),
      }),
    ],
    [t],
  );

  const categories = data?.blog_categories ?? [];

  const table = useDataTable({
    columns,
    data: categories,
    getRowId: (row) => row.id,
    rowCount: data?.count ?? 0,
    isLoading: isPending,
    // `useDataTable` tipa el segundo argumento como el registro, pero en runtime
    // entrega la Row de TanStack. Sin `.original` el drawer abre en blanco y, al
    // guardar, pisa description/image/sort_order de la categoría real.
    onRowClick: (_e, row) =>
      setEditing((row as unknown as { original?: BlogCategory }).original ?? row),
  });

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
          <Heading>{t('CATEGORIES_TITLE')}</Heading>
          <Button size="small" variant="secondary" onClick={() => setCreateOpen(true)}>
            {t('CREATE_CATEGORY')}
          </Button>
        </DataTable.Toolbar>
        {categories.length > 0 || isPending ? (
          <DataTable.Table />
        ) : (
          <div className="flex items-center justify-center border-t p-6 text-center">
            <Text className="text-ui-fg-subtle">{t('CATEGORIES_EMPTY')}</Text>
          </div>
        )}
      </DataTable>

      <CategoryDrawer open={createOpen} onOpenChange={setCreateOpen} />
      {editing && (
        <CategoryDrawer
          category={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      <Toaster />
    </Container>
  );
};

function CategoryDrawer({
  category,
  open,
  onOpenChange,
}: {
  category?: BlogCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('blog');
  const isEdit = !!category;
  const createMut = useCreateBlogCategory();
  const updateMut = useUpdateBlogCategory();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<BlogImage | null>(null);
  const [sortOrder, setSortOrder] = useState('0');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '');
      setSlug(category?.slug ?? '');
      setDescription(category?.description ?? '');
      setImage((category?.image as BlogImage) ?? null);
      setSortOrder(String(category?.sort_order ?? 0));
    }
  }, [open, category]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const f = res.files?.[0];
      if (f?.url) setImage({ url: f.url, file_id: f.id, alt: name });
    } finally {
      setUploading(false);
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t('VALIDATION_TITLE_REQUIRED'));
      return;
    }
    const payload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      description: description || null,
      image,
      sort_order: Number(sortOrder) || 0,
    };
    try {
      if (isEdit && category) {
        await updateMut.mutateAsync({ id: category.id, ...payload });
      } else {
        await createMut.mutateAsync(payload);
      }
      toast.success(t('CATEGORY_SAVED'));
      onOpenChange(false);
    } catch (e: any) {
      toast.error(t('SAVE_ERROR', { msg: e?.message ?? '' }));
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>
            {isEdit ? t('EDIT_CATEGORY') : t('CREATE_CATEGORY')}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label size="small" weight="plus">{t('FIELD_NAME')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label size="small" weight="plus">{t('FIELD_SLUG')}</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label size="small" weight="plus">{t('FIELD_DESCRIPTION')}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label size="small" weight="plus">{t('FIELD_ORDER')}</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label size="small" weight="plus">{t('FIELD_IMAGE')}</Label>
            {image?.url ? (
              <div className="overflow-hidden rounded-lg border border-ui-border-base">
                <img src={image.url} alt="" className="h-28 w-full object-cover" />
              </div>
            ) : null}
            <div className="flex gap-2">
              <label className="inline-flex">
                <Button variant="secondary" size="small" asChild>
                  <span>{uploading ? t('UPLOADING') : t('UPLOAD')}</span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              {image?.url ? (
                <Button variant="transparent" size="small" onClick={() => setImage(null)}>
                  {t('REMOVE_IMAGE')}
                </Button>
              ) : null}
            </div>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">{t('CANCEL')}</Button>
          </Drawer.Close>
          <Button onClick={handleSubmit} isLoading={isPending}>
            {t('SAVE')}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

const CategoriesIcon = () => <Tag />;

export const config = defineRouteConfig({
  label: 'Categorías',
  icon: CategoriesIcon,
});

export default CategoriesPage;
