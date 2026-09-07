import { defineRouteConfig } from '@medusajs/admin-sdk';
import { EllipsisHorizontal, Window } from '@medusajs/icons';
import {
  Button,
  Container,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  StatusBadge,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  Text,
  Textarea,
  Toaster,
  toast,
  useDataTable,
  usePrompt,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
// TODO Fase B: ExtensionVersion badge removed — the component lives in the
// host under apps/backend/src/admin/components/common/extension-version and is
// not exported from the plugin. Re-add when a shared components package exists.
import {
  type LandingPage,
  type LandingPageStatus,
  useCreateLandingPage,
  useDeleteLandingPage,
  useDuplicateLandingPage,
  useLandingPages,
  usePublishLandingPage,
  useUnpublishLandingPage,
  useUpdateLandingPage,
} from '../../hooks/api/landing-pages';
import { registerLandingPagesTranslations } from '../../translations/landing-pages';

const PAGE_SIZE = 20;
const STATUSES: LandingPageStatus[] = ['draft', 'published', 'archived'];

const columnHelper = createDataTableColumnHelper<LandingPage>();

type FormState = {
  title: string;
  slug: string;
  status: LandingPageStatus;
  locale: string;
  seo_title: string;
  seo_description: string;
};

const EMPTY_FORM: FormState = {
  title: '',
  slug: '',
  status: 'draft',
  locale: '',
  seo_title: '',
  seo_description: '',
};

function statusColor(status: string): 'green' | 'orange' | 'grey' {
  if (status === 'published') return 'green';
  if (status === 'archived') return 'grey';
  return 'orange';
}

const LandingPagesPage = () => {
  const { t, i18n } = useTranslation('landingPages');
  registerLandingPagesTranslations(i18n);
  const prompt = usePrompt();
  const navigate = useNavigate();

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const { data, isLoading } = useLandingPages({
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  });
  const landingPages = data?.landing_pages ?? [];
  const count = data?.count ?? 0;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<LandingPage | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const createMut = useCreateLandingPage();
  const updateMut = useUpdateLandingPage(editing?.id ?? '');
  const deleteMut = useDeleteLandingPage();
  const publishMut = usePublishLandingPage();
  const unpublishMut = useUnpublishLandingPage();
  const duplicateMut = useDuplicateLandingPage();

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  };

  const openEdit = (lp: LandingPage) => {
    setEditing(lp);
    setForm({
      title: lp.title,
      slug: lp.slug,
      status: lp.status,
      locale: lp.locale ?? '',
      seo_title: lp.seo?.title ?? '',
      seo_description: lp.seo?.description ?? '',
    });
    setDrawerOpen(true);
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error(t('VALIDATION_TITLE_REQUIRED'));
      return;
    }
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || undefined,
      status: form.status,
      locale: form.locale.trim() || null,
      seo:
        form.seo_title || form.seo_description
          ? {
              title: form.seo_title || undefined,
              description: form.seo_description || undefined,
            }
          : null,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync(payload);
        toast.success(t('UPDATE_SUCCESS'));
      } else {
        await createMut.mutateAsync(payload);
        toast.success(t('CREATE_SUCCESS'));
      }
      setDrawerOpen(false);
    } catch (error: any) {
      toast.error(t('ACTION_ERROR', { msg: error?.message ?? '' }));
    }
  };

  const runAction = async (
    fn: () => Promise<unknown>,
    successKey: string,
  ) => {
    try {
      await fn();
      toast.success(t(successKey));
    } catch (error: any) {
      toast.error(t('ACTION_ERROR', { msg: error?.message ?? '' }));
    }
  };

  const handleDelete = async (lp: LandingPage) => {
    const confirmed = await prompt({
      title: t('DELETE'),
      description: t('DELETE_CONFIRM'),
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    await runAction(() => deleteMut.mutateAsync(lp.id), 'DELETE_SUCCESS');
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: t('COLUMN_TITLE'),
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      columnHelper.accessor('slug', {
        header: t('COLUMN_SLUG'),
        cell: ({ getValue }) => <span className="text-ui-fg-subtle">{getValue()}</span>,
      }),
      columnHelper.accessor('status', {
        header: t('COLUMN_STATUS'),
        cell: ({ getValue }) => (
          <StatusBadge color={statusColor(getValue())}>
            {t(`STATUS_${getValue().toUpperCase()}`)}
          </StatusBadge>
        ),
      }),
      columnHelper.accessor('locale', {
        header: t('COLUMN_LOCALE'),
        cell: ({ getValue }) => (
          <span className="text-ui-fg-subtle">{getValue() ?? '—'}</span>
        ),
      }),
      columnHelper.accessor('updated_at', {
        header: t('COLUMN_UPDATED'),
        cell: ({ getValue }) => (
          <span className="text-ui-fg-subtle">
            {getValue() ? new Date(getValue()!).toLocaleDateString() : '—'}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const lp = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <IconButton variant="transparent">
                    <EllipsisHorizontal />
                  </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Item onClick={() => navigate(`/landing-pages/${lp.id}`)}>
                    {t('EDIT_CONTENT')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onClick={() => openEdit(lp)}>
                    {t('EDIT')}
                  </DropdownMenu.Item>
                  {lp.status === 'published' ? (
                    <DropdownMenu.Item
                      onClick={() =>
                        runAction(() => unpublishMut.mutateAsync(lp.id), 'UNPUBLISH_SUCCESS')
                      }
                    >
                      {t('UNPUBLISH')}
                    </DropdownMenu.Item>
                  ) : (
                    <DropdownMenu.Item
                      onClick={() =>
                        runAction(() => publishMut.mutateAsync(lp.id), 'PUBLISH_SUCCESS')
                      }
                    >
                      {t('PUBLISH')}
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Item
                    onClick={() =>
                      runAction(() => duplicateMut.mutateAsync(lp.id), 'DUPLICATE_SUCCESS')
                    }
                  >
                    {t('DUPLICATE')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item onClick={() => handleDelete(lp)}>
                    {t('DELETE')}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            </div>
          );
        },
      }),
    ],
    [t],
  );

  const table = useDataTable({
    columns,
    data: landingPages,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_e, row) => navigate(`/landing-pages/${row.id}`),
  });

  return (
    <>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="flex items-center gap-x-2">
                <Heading>{t('TITLE')}</Heading>
                {/* TODO Fase B: <ExtensionVersion extension="landing-pages" /> */}
              </div>
            </div>
            <Button size="small" variant="secondary" onClick={openCreate}>
              {t('CREATE_BUTTON')}
            </Button>
          </DataTable.Toolbar>
          {count > 0 || isLoading ? (
            <>
              <DataTable.Table />
              <DataTable.Pagination />
            </>
          ) : (
            <div className="flex items-center justify-center border-t p-6 text-center">
              <Text className="text-ui-fg-subtle">{t('EMPTY_STATE')}</Text>
            </div>
          )}
        </DataTable>
      </Container>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {editing ? t('EDIT_TITLE') : t('CREATE_TITLE')}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
            <div className="flex flex-col gap-1">
              <Label size="xsmall">{t('FIELD_TITLE')}</Label>
              <Input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder={t('FIELD_TITLE_PLACEHOLDER')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">{t('FIELD_SLUG')}</Label>
              <Input
                value={form.slug}
                onChange={(e) => set('slug', e.target.value)}
                placeholder={t('FIELD_SLUG_PLACEHOLDER')}
              />
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('FIELD_SLUG_HELP')}
              </Text>
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">{t('FIELD_STATUS')}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set('status', v as LandingPageStatus)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {STATUSES.map((s) => (
                    <Select.Item key={s} value={s}>
                      {t(`STATUS_${s.toUpperCase()}`)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">{t('FIELD_LOCALE')}</Label>
              <Input
                value={form.locale}
                onChange={(e) => set('locale', e.target.value)}
                placeholder={t('FIELD_LOCALE_PLACEHOLDER')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">{t('FIELD_SEO_TITLE')}</Label>
              <Input
                value={form.seo_title}
                onChange={(e) => set('seo_title', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">{t('FIELD_SEO_DESCRIPTION')}</Label>
              <Textarea
                value={form.seo_description}
                onChange={(e) => set('seo_description', e.target.value)}
                rows={3}
              />
            </div>
            <div className="rounded-lg bg-ui-bg-subtle p-3">
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('CONTENT_EDITOR_HINT')}
              </Text>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">{t('CANCEL')}</Button>
            </Drawer.Close>
            <Button
              onClick={handleSave}
              isLoading={createMut.isPending || updateMut.isPending}
            >
              {t('SAVE')}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Toaster />
    </>
  );
};

// Icono tipo "ventana de navegador" (website), distinto del blog (DocumentText).
const LandingsIcon = () => <Window style={{ color: '#4B8EEF' }} />;

export const config = defineRouteConfig({
  label: 'Landings',
  icon: LandingsIcon,
  rank: 40,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Landings',
};

export default LandingPagesPage;
