import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  Heading,
  Input,
  Label,
  StatusBadge,
  Switch,
  Text,
  toast,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAndreaniBoxes,
  useCreateAndreaniBox,
  useUpdateAndreaniBox,
  useDeleteAndreaniBox,
  type AndreaniBox,
} from '../../../hooks/api/andreani';
import { registerAndreaniTranslations } from '../../../translations/andreani';

type FormState = {
  id?: string;
  name: string;
  height: string;
  width: string;
  deep: string;
  max_capacity: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  height: '',
  width: '',
  deep: '',
  max_capacity: '0',
  is_active: true,
};

const columnHelper = createDataTableColumnHelper<AndreaniBox>();

export function BoxList() {
  const { t, i18n } = useTranslation('andreani');
  registerAndreaniTranslations(i18n);

  const { data, isLoading } = useAndreaniBoxes();
  const createBox = useCreateAndreaniBox();
  const updateBox = useUpdateAndreaniBox();
  const deleteBox = useDeleteAndreaniBox();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const boxes = data?.boxes ?? [];

  const resetForm = () => setForm(EMPTY_FORM);

  const handleSubmit = () => {
    const payload = {
      name: form.name.trim(),
      height: Number(form.height),
      width: Number(form.width),
      deep: Number(form.deep),
      max_capacity: Number(form.max_capacity) || 0,
      is_active: form.is_active,
    };
    if (
      !payload.name ||
      !(payload.height > 0) ||
      !(payload.width > 0) ||
      !(payload.deep > 0)
    ) {
      toast.error(t('BOX_INVALID'));
      return;
    }

    if (form.id) {
      updateBox.mutate(
        { id: form.id, ...payload },
        {
          onSuccess: () => {
            toast.success(t('BOX_SAVED'));
            resetForm();
          },
          onError: (e) => toast.error((e as Error).message),
        }
      );
    } else {
      createBox.mutate(payload, {
        onSuccess: () => {
          toast.success(t('BOX_SAVED'));
          resetForm();
        },
        onError: (e) => toast.error((e as Error).message),
      });
    }
  };

  const handleEdit = (box: AndreaniBox) => {
    setForm({
      id: box.id,
      name: box.name,
      height: String(box.height),
      width: String(box.width),
      deep: String(box.deep),
      max_capacity: String(box.max_capacity ?? 0),
      is_active: box.is_active,
    });
  };

  const handleDelete = (box: AndreaniBox) => {
    if (!window.confirm(t('BOX_DELETE_CONFIRM', { name: box.name }))) return;
    deleteBox.mutate(box.id, {
      onSuccess: () => toast.success(t('BOX_DELETED')),
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('BOX_NAME'),
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      columnHelper.accessor('height', {
        header: t('BOX_HEIGHT'),
        cell: ({ getValue }) => <span>{getValue()}</span>,
      }),
      columnHelper.accessor('width', {
        header: t('BOX_WIDTH'),
        cell: ({ getValue }) => <span>{getValue()}</span>,
      }),
      columnHelper.accessor('deep', {
        header: t('BOX_DEEP'),
        cell: ({ getValue }) => <span>{getValue()}</span>,
      }),
      columnHelper.accessor('max_capacity', {
        header: t('BOX_MAX_CAPACITY'),
        cell: ({ getValue }) => <span>{getValue() || '—'}</span>,
      }),
      columnHelper.accessor('is_active', {
        header: t('COL_STATUS'),
        cell: ({ getValue }) => (
          <StatusBadge color={getValue() ? 'green' : 'grey'}>
            {getValue() ? t('BOX_ON') : t('BOX_OFF')}
          </StatusBadge>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button variant="secondary" size="small" onClick={() => handleEdit(row.original)}>
              {t('BOX_EDIT')}
            </Button>
            <Button variant="secondary" size="small" onClick={() => handleDelete(row.original)}>
              {t('BOX_DELETE')}
            </Button>
          </div>
        ),
      }),
    ],
    [t]
  );

  const table = useDataTable({
    columns,
    data: boxes,
    getRowId: (row) => row.id,
    rowCount: boxes.length,
    isLoading,
  });

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start gap-y-4 px-6 py-4">
          <Heading>{t('BOXES_TITLE')}</Heading>

          {/* Formulario */}
          <div className="grid w-full grid-cols-1 gap-3 rounded-lg border border-ui-border-base p-4 md:grid-cols-6">
            <div className="md:col-span-2">
              <Label size="xsmall">{t('BOX_NAME')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label size="xsmall">{t('BOX_HEIGHT')}</Label>
              <Input
                type="number"
                value={form.height}
                onChange={(e) => setForm({ ...form, height: e.target.value })}
              />
            </div>
            <div>
              <Label size="xsmall">{t('BOX_WIDTH')}</Label>
              <Input
                type="number"
                value={form.width}
                onChange={(e) => setForm({ ...form, width: e.target.value })}
              />
            </div>
            <div>
              <Label size="xsmall">{t('BOX_DEEP')}</Label>
              <Input
                type="number"
                value={form.deep}
                onChange={(e) => setForm({ ...form, deep: e.target.value })}
              />
            </div>
            <div>
              <Label size="xsmall">{t('BOX_MAX_CAPACITY')}</Label>
              <Input
                type="number"
                value={form.max_capacity}
                onChange={(e) => setForm({ ...form, max_capacity: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label size="xsmall">{t('BOX_ACTIVE')}</Label>
            </div>
            <div className="flex items-end gap-2 md:col-span-3">
              <Button
                size="small"
                onClick={handleSubmit}
                isLoading={createBox.isPending || updateBox.isPending}
              >
                {form.id ? t('BOX_UPDATE') : t('BOX_CREATE')}
              </Button>
              {form.id && (
                <Button variant="secondary" size="small" onClick={resetForm}>
                  {t('BOX_CANCEL')}
                </Button>
              )}
            </div>
          </div>
        </DataTable.Toolbar>
        {boxes.length > 0 || isLoading ? (
          <DataTable.Table />
        ) : (
          <div className="flex items-center justify-center border-t p-6 text-center">
            <Text className="text-ui-fg-subtle">{t('BOXES_EMPTY')}</Text>
          </div>
        )}
      </DataTable>
    </Container>
  );
}
