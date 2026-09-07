import { EllipsisHorizontal, Eye, PencilSquare, Trash } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  DataTable,
  DropdownMenu,
  Heading,
  IconButton,
  StatusBadge,
  Text,
  createDataTableColumnHelper,
  toast,
  useDataTable,
  usePrompt,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KapsoBindingsMap,
  KapsoTemplate,
  useDeleteKapsoTemplate,
  useKapsoBindings,
  useKapsoTemplates,
} from '../../../hooks/api/kapso';
import { WHATSAPP_EVENT_BY_KEY } from '../../../lib/whatsapp-events-catalog';
import { kapsoErrorKey } from '../../../lib/kapso-error';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { registerWhatsappTranslations } from '../../../translations/whatsapp';
import { TemplateCreateModal } from './template-create-modal';
import { TemplateViewDrawer } from './template-view-drawer';

function statusColor(status?: string): 'green' | 'orange' | 'red' | 'grey' {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED':
      return 'green';
    case 'PENDING':
    case 'IN_APPEAL':
    case 'PENDING_DELETION':
      return 'orange';
    case 'REJECTED':
    case 'DISABLED':
    case 'PAUSED':
      return 'red';
    default:
      return 'grey';
  }
}

/** Eventos a los que está asignado un template (reverse-lookup sobre bindings). */
function eventsForTemplate(name: string, bindings: KapsoBindingsMap) {
  return Object.entries(bindings)
    .filter(([, b]) => b.template_name === name)
    .map(([key, b]) => ({
      key,
      labelKey: WHATSAPP_EVENT_BY_KEY[key]?.labelKey,
      published: b.status === 'published',
    }));
}

const columnHelper = createDataTableColumnHelper<KapsoTemplate>();

export const TemplatesTab = () => {
  const { t, i18n } = useTranslation('whatsapp');
  registerWhatsappTranslations(i18n);

  const { data, isPending, isError, error } = useKapsoTemplates({ retry: false });
  const { data: bindingsData } = useKapsoBindings({ retry: false });
  const prompt = usePrompt();
  const { mutateAsync: deleteTemplate } = useDeleteKapsoTemplate();
  const [viewing, setViewing] = useState<KapsoTemplate | null>(null);
  const [editing, setEditing] = useState<KapsoTemplate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const templates = data?.templates ?? [];
  const bindings = bindingsData?.bindings ?? {};

  const onDelete = async (name: string) => {
    const confirmed = await prompt({
      title: t('CONFIRM_DELETE_TITLE'),
      description: t('CONFIRM_DELETE_DESC', { name }),
      confirmText: t('CONFIRM_DELETE_CONFIRM'),
      cancelText: t('CONFIRM_CANCEL'),
    });
    if (!confirmed) return;
    try {
      await deleteTemplate(name);
      toast.success(t('TOAST_DELETED', { name }));
    } catch (e) {
      const raw = (e as Error)?.message;
      const known = kapsoErrorKey(raw);
      toast.error(t('TOAST_DELETE_FAILED'), { description: known ? t(known) : raw });
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('COL_NAME'),
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      columnHelper.accessor('language', {
        header: t('COL_LANGUAGE'),
        cell: ({ getValue }) => <span className="text-ui-fg-subtle">{getValue()}</span>,
      }),
      columnHelper.accessor('category', {
        header: t('COL_CATEGORY'),
        cell: ({ getValue }) => <span className="text-ui-fg-subtle">{getValue()}</span>,
      }),
      columnHelper.accessor('status', {
        header: t('COL_STATUS'),
        cell: ({ getValue }) => (
          <StatusBadge color={statusColor(getValue())}>{getValue() ?? '—'}</StatusBadge>
        ),
      }),
      columnHelper.display({
        id: 'events',
        header: t('COL_EVENT'),
        cell: ({ row }) => {
          const assigned = eventsForTemplate(row.original.name, bindings);
          if (!assigned.length) {
            return <span className="text-ui-fg-muted">{t('UNASSIGNED')}</span>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {assigned.map((a) => (
                <Badge key={a.key} size="2xsmall" color={a.published ? 'green' : 'grey'}>
                  {a.labelKey ? t(a.labelKey) : a.key}
                </Badge>
              ))}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <IconButton size="small" variant="transparent">
                  <EllipsisHorizontal />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item
                  className="gap-x-2"
                  onClick={() => setViewing(row.original)}
                >
                  <Eye className="text-ui-fg-subtle" />
                  {t('ACTION_VIEW')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="gap-x-2"
                  onClick={() => setEditing(row.original)}
                >
                  <PencilSquare className="text-ui-fg-subtle" />
                  {t('ACTION_EDIT')}
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  className="gap-x-2"
                  onClick={() => onDelete(row.original.name)}
                >
                  <Trash className="text-ui-fg-subtle" />
                  {t('ACTION_DELETE')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        ),
      }),
    ],
    [bindings, t, i18n.language],
  );

  const table = useDataTable({
    columns,
    data: templates,
    getRowId: (row) => row.name,
    rowCount: templates.length,
    isLoading: isPending,
  });

  return (
    <>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-x-2">
              <Heading>{t('TITLE')}</Heading>
              <ExtensionVersion extension="whatsapp" />
            </div>
            <Button size="small" variant="secondary" onClick={() => setCreateOpen(true)}>
              {t('CREATE_BUTTON')}
            </Button>
          </DataTable.Toolbar>

          {isError ? (
            (() => {
              const raw = (error as Error)?.message;
              const known = kapsoErrorKey(raw);
              return (
                <div className="flex flex-col items-center gap-2 border-t p-6 text-center">
                  <Text className="text-ui-fg-error">{t('ERROR_LOAD_TITLE')}</Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    {known ? t(known) : t('ERROR_LOAD_DESC')}
                  </Text>
                  {!known && raw && (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {raw}
                    </Text>
                  )}
                </div>
              );
            })()
          ) : templates.length > 0 || isPending ? (
            <DataTable.Table />
          ) : (
            <div className="flex items-center justify-center border-t p-6 text-center">
              <Text className="text-ui-fg-subtle">{t('EMPTY_STATE')}</Text>
            </div>
          )}
        </DataTable>
      </Container>

      <TemplateCreateModal open={createOpen} onOpenChange={setCreateOpen} />

      {viewing && (
        <TemplateViewDrawer
          template={viewing}
          bindings={bindings}
          open={!!viewing}
          onOpenChange={(open) => {
            if (!open) setViewing(null);
          }}
        />
      )}

      {editing && (
        <TemplateCreateModal
          template={editing}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
    </>
  );
};
