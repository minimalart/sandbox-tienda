import { Button, DatePicker, Drawer, Heading, Input, Label, Select, Text, Textarea, toast } from '@medusajs/ui';
import { dateToLocalInput, localInputToDate } from '../../../lib/date';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type MinimumPurchase,
  useCreateMinimumPurchase,
  useUpdateMinimumPurchase,
} from '../../../hooks/api';
import { registerStoreConfigTranslations } from '../../../translations/store-config';

const CURRENCIES = ['ars', 'usd', 'eur'] as const;

type FormState = {
  amount: string;
  currency: string;
  startsAt: string;
  endsAt: string;
  note: string;
};

const EMPTY_FORM: FormState = { amount: '', currency: 'ars', startsAt: '', endsAt: '', note: '' };

/** La fila guardada, en el formato de los inputs (fechas en local, como las carga el DatePicker). */
const formFromRecord = (record: MinimumPurchase): FormState => ({
  amount: String(record.amount),
  currency: record.currency_code,
  startsAt: dateToLocalInput(new Date(record.starts_at)),
  endsAt: record.ends_at ? dateToLocalInput(new Date(record.ends_at)) : '',
  note: record.note ?? '',
});

type MinimumPurchaseFormProps = {
  /** Sin `record` es un alta; con `record` edita esa fila en su lugar. */
  record?: MinimumPurchase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** El disparador (botón "Crear"). El modo edición no lo tiene: lo abre la fila. */
  trigger?: React.ReactNode;
};

/**
 * Un solo formulario para crear y editar. Son los mismos cinco campos y las mismas
 * validaciones; lo único que cambia es a qué ruta va el submit y con qué textos.
 */
const MinimumPurchaseForm = ({ record, open, onOpenChange, trigger }: MinimumPurchaseFormProps) => {
  const { t, i18n } = useTranslation('storeConfig');
  registerStoreConfigTranslations(i18n);
  const isEdit = Boolean(record);
  const [form, setForm] = useState<FormState>(record ? formFromRecord(record) : EMPTY_FORM);

  // Al abrir, el formulario arranca de la fila a editar (o vacío). Se resetea en
  // `open` y no en `record`: la misma fila puede abrirse dos veces y tiene que
  // volver a mostrar lo guardado, no lo que quedó tipeado la vez anterior.
  useEffect(() => {
    if (!open) return;
    setForm(record ? formFromRecord(record) : EMPTY_FORM);
  }, [open, record]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const { mutateAsync: createMinimumPurchase, isPending: creating } = useCreateMinimumPurchase({
    onSuccess: () => {
      toast.success(t('CREATE_SUCCESS'));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(t('CREATE_ERROR', { msg: error.message }));
    },
  });

  const { mutateAsync: updateMinimumPurchase, isPending: updating } = useUpdateMinimumPurchase({
    onSuccess: () => {
      toast.success(t('UPDATE_SUCCESS'));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(t('UPDATE_ERROR', { msg: error.message }));
    },
  });

  const isPending = creating || updating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = Number(form.amount);
    if (!form.amount || !Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      toast.error(t('VALIDATION_AMOUNT'));
      return;
    }
    if (!form.startsAt) {
      toast.error(t('VALIDATION_STARTS_AT'));
      return;
    }
    if (form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      toast.error(t('VALIDATION_ENDS_AT'));
      return;
    }

    const payload = {
      amount: parsedAmount,
      currency_code: form.currency,
      starts_at: new Date(form.startsAt).toISOString(),
      note: form.note.trim() || null,
    };

    if (record) {
      // `ends_at: null` explícito: es la forma de sacarle la fecha de fin a una fila
      // que la tenía. `undefined` la dejaría como estaba.
      await updateMinimumPurchase({
        id: record.id,
        ...payload,
        ends_at: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      });
      return;
    }

    await createMinimumPurchase({
      ...payload,
      ends_at: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      note: payload.note ?? undefined,
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {trigger ? <Drawer.Trigger asChild>{trigger}</Drawer.Trigger> : null}
      <Drawer.Content>
        <Drawer.Header>
          <Heading>{isEdit ? t('EDIT_TITLE') : t('CREATE_TITLE')}</Heading>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-y-auto p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">{t('FIELD_AMOUNT_LABEL')}</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                step={1}
                placeholder={t('FIELD_AMOUNT_PLACEHOLDER')}
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="currency">{t('FIELD_CURRENCY_LABEL')}</Label>
              <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                <Select.Trigger id="currency">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {CURRENCIES.map((code) => (
                    <Select.Item key={code} value={code}>
                      {t(`CURRENCY_${code.toUpperCase()}`)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="starts_at">{t('FIELD_STARTS_AT_LABEL')}</Label>
              <DatePicker
                granularity="minute"
                value={localInputToDate(form.startsAt)}
                onChange={(d) => set('startsAt', dateToLocalInput(d))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ends_at">{t('FIELD_ENDS_AT_LABEL')}</Label>
              <DatePicker
                granularity="minute"
                value={localInputToDate(form.endsAt)}
                onChange={(d) => set('endsAt', dateToLocalInput(d))}
              />
              <Text size="small" className="text-ui-fg-subtle">
                {t('FIELD_ENDS_AT_HELP')}
              </Text>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="note">{t('FIELD_NOTE_LABEL')}</Label>
              <Textarea
                id="note"
                placeholder={t('FIELD_NOTE_PLACEHOLDER')}
                value={form.note}
                onChange={(e) => set('note', e.target.value)}
                rows={3}
              />
            </div>
          </form>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">{t('CANCEL')}</Button>
          </Drawer.Close>
          <Button onClick={handleSubmit} isLoading={isPending}>
            {isEdit ? t('EDIT_SUBMIT') : t('CREATE_SUBMIT')}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

/** Botón "Crear" + drawer de alta. Maneja su propio `open`. */
export const MinimumPurchaseCreateDrawer = () => {
  const { t, i18n } = useTranslation('storeConfig');
  registerStoreConfigTranslations(i18n);
  const [open, setOpen] = useState(false);

  return (
    <MinimumPurchaseForm
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="secondary" size="small">
          {t('CREATE_BUTTON')}
        </Button>
      }
    />
  );
};

type MinimumPurchaseEditDrawerProps = {
  /** La fila a editar; `null` cierra el drawer. */
  record: MinimumPurchase | null;
  onClose: () => void;
};

/** Drawer de edición, controlado por la tabla: se abre con la fila elegida en el menú de acciones. */
export const MinimumPurchaseEditDrawer = ({ record, onClose }: MinimumPurchaseEditDrawerProps) => (
  <MinimumPurchaseForm
    record={record}
    open={Boolean(record)}
    onOpenChange={(next) => {
      if (!next) onClose();
    }}
  />
);
