import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Envelope, EllipsisHorizontal } from '@medusajs/icons';
import {
  Badge,
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
import { ExtensionVersion } from '../../components/common/extension-version';
import { SiteScopeBar } from '../../components/common/site-scope-bar';
import { EventKeyCombobox } from '../../components/common/event-key-combobox';
import {
  type EmailTemplate,
  type EmailTemplateStatus,
  useCreateEmailTemplate,
  useDeleteEmailTemplate,
  useEmailTemplates,
  usePublishEmailTemplate,
  useUnpublishEmailTemplate,
  useUpdateEmailTemplate,
} from '../../hooks/api/email-templates';
import { registerEmailTemplatesTranslations } from '../../translations/email-templates';
import {
  EMAIL_EVENTS,
  audienceForKey,
  eventIdForKey,
} from '../../lib/email-events-catalog';

const PAGE_SIZE = 200; // fetch all — grouping is client-side
const STATUSES: EmailTemplateStatus[] = ['draft', 'published'];

type FormState = {
  name: string;
  key: string;
  status: EmailTemplateStatus;
  locale: string;
  subject: string;
  description: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  key: '',
  status: 'draft',
  locale: '',
  subject: '',
  description: '',
};

function statusColor(status: string): 'green' | 'orange' {
  return status === 'published' ? 'green' : 'orange';
}

function audienceBadgeColor(
  audience: ReturnType<typeof audienceForKey>,
): 'blue' | 'grey' {
  return audience === 'admin' ? 'grey' : 'blue';
}

type TemplateGroup = {
  eventLabel: string;
  eventId: string | null;
  templates: EmailTemplate[];
};

// Fila plana para la DataTable: el template + el label del evento al que
// pertenece (la DataTable no soporta filas de encabezado de grupo).
type EmailRow = EmailTemplate & { _eventLabel: string };

const columnHelper = createDataTableColumnHelper<EmailRow>();

function groupTemplates(templates: EmailTemplate[]): TemplateGroup[] {
  // Build a map: eventId → group.
  const grouped = new Map<string, TemplateGroup>();

  for (const tpl of templates) {
    const eventId =
      (tpl.metadata?.event as string | undefined) ?? eventIdForKey(tpl.key);
    const catalogEvent = EMAIL_EVENTS.find((e) => e.event === eventId);
    const eventLabel =
      catalogEvent?.label ?? (tpl.metadata?.event as string | undefined) ?? 'Otros';
    const key = eventId ?? '__otros__';

    if (!grouped.has(key)) {
      grouped.set(key, { eventLabel, eventId, templates: [] });
    }
    grouped.get(key)!.templates.push(tpl);
  }

  // Sort groups by the catalog order, then ungrouped last.
  const catalogOrder = EMAIL_EVENTS.map((e) => e.event);
  const sorted = [...grouped.values()].sort((a, b) => {
    const ai = a.eventId ? catalogOrder.indexOf(a.eventId) : Infinity;
    const bi = b.eventId ? catalogOrder.indexOf(b.eventId) : Infinity;
    if (ai !== bi) return ai - bi;
    return a.eventLabel.localeCompare(b.eventLabel);
  });

  return sorted;
}

const EmailTemplatesPage = () => {
  const { t, i18n } = useTranslation('emailTemplates');
  registerEmailTemplatesTranslations(i18n);
  const prompt = usePrompt();
  const navigate = useNavigate();

  const { data, isLoading } = useEmailTemplates({ limit: PAGE_SIZE, offset: 0 });
  const templates = data?.email_templates ?? [];

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const createMut = useCreateEmailTemplate();
  const updateMut = useUpdateEmailTemplate(editing?.id ?? '');
  const deleteMut = useDeleteEmailTemplate();
  const publishMut = usePublishEmailTemplate();
  const unpublishMut = useUnpublishEmailTemplate();

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  };

  const openEdit = (tpl: EmailTemplate) => {
    setEditing(tpl);
    setForm({
      name: tpl.name,
      key: tpl.key,
      status: tpl.status,
      locale: tpl.locale ?? '',
      subject: tpl.subject,
      description: tpl.description ?? '',
    });
    setDrawerOpen(true);
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('VALIDATION_NAME_REQUIRED'));
      return;
    }
    const payload = {
      name: form.name.trim(),
      key: form.key.trim() || undefined,
      status: form.status,
      locale: form.locale.trim() || null,
      subject: form.subject.trim() || form.name.trim(),
      description: form.description.trim() || null,
      ...(editing ? {} : { html: '<p></p>' }),
    };
    try {
      if (editing) {
        await updateMut.mutateAsync(payload);
        toast.success(t('UPDATE_SUCCESS'));
      } else {
        const created = await createMut.mutateAsync(payload);
        toast.success(t('CREATE_SUCCESS'));
        setDrawerOpen(false);
        navigate(`/email-templates/${created.id}`);
        return;
      }
      setDrawerOpen(false);
    } catch (error: any) {
      toast.error(t('ACTION_ERROR', { msg: error?.message ?? '' }));
    }
  };

  const runAction = async (fn: () => Promise<unknown>, successKey: string) => {
    try {
      await fn();
      toast.success(t(successKey));
    } catch (error: any) {
      toast.error(t('ACTION_ERROR', { msg: error?.message ?? '' }));
    }
  };

  const handleDelete = async (tpl: EmailTemplate) => {
    const confirmed = await prompt({
      title: t('DELETE'),
      description: t('DELETE_CONFIRM'),
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    await runAction(() => deleteMut.mutateAsync(tpl.id), 'DELETE_SUCCESS');
  };

  // Aplanamos los grupos a filas, manteniendo el orden por evento y agregando
  // el label del evento como columna (la DataTable no soporta filas de
  // encabezado de grupo).
  const rows = useMemo<EmailRow[]>(
    () =>
      groupTemplates(templates).flatMap((group) =>
        group.templates.map((tpl) => ({ ...tpl, _eventLabel: group.eventLabel })),
      ),
    [templates],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('COLUMN_NAME'),
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      columnHelper.accessor('_eventLabel', {
        header: t('COLUMN_EVENT', { defaultValue: 'Evento' }),
        cell: ({ getValue }) => <span className="text-ui-fg-subtle">{getValue()}</span>,
      }),
      columnHelper.accessor('key', {
        header: t('COLUMN_KEY'),
        cell: ({ getValue }) => (
          <span className="text-ui-fg-subtle font-mono text-xs">{getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: 'audience',
        header: t('COLUMN_AUDIENCE', { defaultValue: 'Audiencia' }),
        cell: ({ row }) => {
          const tpl = row.original;
          const audience =
            (tpl.metadata?.audience as ReturnType<typeof audienceForKey>) ??
            audienceForKey(tpl.key);
          const audienceLabel =
            audience === 'admin' ? 'Admin' : audience === 'user' ? 'Usuario' : null;
          return audienceLabel ? (
            <Badge size="2xsmall" color={audienceBadgeColor(audience)}>
              {audienceLabel}
            </Badge>
          ) : null;
        },
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
          const tpl = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <IconButton variant="transparent">
                    <EllipsisHorizontal />
                  </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Item onClick={() => navigate(`/email-templates/${tpl.id}`)}>
                    {t('EDIT_CONTENT')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onClick={() => openEdit(tpl)}>
                    {t('EDIT')}
                  </DropdownMenu.Item>
                  {tpl.status === 'published' ? (
                    <DropdownMenu.Item
                      onClick={() =>
                        runAction(() => unpublishMut.mutateAsync(tpl.id), 'UNPUBLISH_SUCCESS')
                      }
                    >
                      {t('UNPUBLISH')}
                    </DropdownMenu.Item>
                  ) : (
                    <DropdownMenu.Item
                      onClick={() =>
                        runAction(() => publishMut.mutateAsync(tpl.id), 'PUBLISH_SUCCESS')
                      }
                    >
                      {t('PUBLISH')}
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item onClick={() => handleDelete(tpl)}>
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

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  // Los templates se traen todos y se agrupan por evento en el cliente, así que
  // la paginación también es del lado del cliente: cortamos las filas por página.
  const pagedRows = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return rows.slice(start, start + pagination.pageSize);
  }, [rows, pagination]);

  const table = useDataTable({
    columns,
    data: pagedRows,
    getRowId: (row) => row.id,
    rowCount: rows.length,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_e, row) => navigate(`/email-templates/${row.id}`),
  });

  return (
    <>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="flex items-center gap-x-2">
                <Heading>{t('TITLE')}</Heading>
                <ExtensionVersion extension="email-templates" />
              </div>
            </div>
            {/* Sin botón de Configuración: los ajustes de emails viven en la
                sub-ruta `settings`, que sí queda en la URL y en el menú. */}
            <Button size="small" variant="secondary" onClick={openCreate}>
              {t('CREATE_BUTTON')}
            </Button>
          </DataTable.Toolbar>

          {/*
            `scoped` con la prueba a mano: `admin/email-templates` mete el filtro en el
            WHERE (`siteFilter(…, EMAIL_TEMPLATE_SITE_SCOPE)`,
            `api/admin/email-templates/route.ts:41`) y el alta hereda la tienda con
            `siteDefaults` en el mismo archivo (`:75`); `[id]` corre `assertIdInSite`.

            El descriptor es `empty: 'all'`: la plantilla con `site_id NULL` es la
            GLOBAL —la que efectivamente se manda cuando la tienda no tiene la suya—,
            así que sigue apareciendo en el listado de todas. Esconderla haría que el
            operador viera salir un mail con un texto que no está en ninguna pantalla.
          */}
          <SiteScopeBar screen="email-templates" />

          {rows.length > 0 || isLoading ? (
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
              <Label size="xsmall">{t('FIELD_NAME')}</Label>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder={t('FIELD_NAME_PLACEHOLDER')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">{t('FIELD_KEY')}</Label>
              <EventKeyCombobox
                value={form.key}
                onChange={(v) => set('key', v)}
                disabled={!!editing}
                placeholder={t('FIELD_KEY_PLACEHOLDER')}
              />
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('FIELD_KEY_HELP')}
              </Text>
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">{t('FIELD_SUBJECT')}</Label>
              <Input
                value={form.subject}
                onChange={(e) => set('subject', e.target.value)}
                placeholder={t('FIELD_SUBJECT_PLACEHOLDER')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">{t('FIELD_STATUS')}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set('status', v as EmailTemplateStatus)}
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
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('FIELD_STATUS_HELP')}
              </Text>
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
              <Label size="xsmall">{t('FIELD_DESCRIPTION')}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={2}
              />
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

const EmailTemplatesIcon = () => <Envelope style={{ color: '#4B8EEF' }} />;

export const config = defineRouteConfig({
  label: 'Sendgrid',
  icon: EmailTemplatesIcon,
  rank: 41,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Sendgrid',
};

export default EmailTemplatesPage;
