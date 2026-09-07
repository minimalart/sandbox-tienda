import { Button, DatePicker, Drawer, Heading, Input, Label, Select, Text, Textarea, toast } from '@medusajs/ui';
import { dateToLocalInput, localInputToDate } from '../../../lib/date';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateMinimumPurchase } from '../../../hooks/api';
import { registerStoreConfigTranslations } from '../../../translations/store-config';

const CURRENCIES = ['ars', 'usd', 'eur'] as const;

export const MinimumPurchaseCreateDrawer = () => {
  const { t, i18n } = useTranslation('storeConfig');
  registerStoreConfigTranslations(i18n);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>('ars');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [note, setNote] = useState('');

  const { mutateAsync: createMinimumPurchase, isPending } = useCreateMinimumPurchase({
    onSuccess: () => {
      toast.success(t('CREATE_SUCCESS'));
      setOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(t('CREATE_ERROR', { msg: error.message }));
    },
  });

  const resetForm = () => {
    setAmount('');
    setCurrency('ars');
    setStartsAt('');
    setEndsAt('');
    setNote('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = Number(amount);
    if (!amount || !Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      toast.error(t('VALIDATION_AMOUNT'));
      return;
    }
    if (!startsAt) {
      toast.error(t('VALIDATION_STARTS_AT'));
      return;
    }
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      toast.error(t('VALIDATION_ENDS_AT'));
      return;
    }

    await createMinimumPurchase({
      amount: parsedAmount,
      currency_code: currency,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button variant="secondary" size="small">
          {t('CREATE_BUTTON')}
        </Button>
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Heading>{t('CREATE_TITLE')}</Heading>
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="currency">{t('FIELD_CURRENCY_LABEL')}</Label>
              <Select value={currency} onValueChange={setCurrency}>
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
                value={localInputToDate(startsAt)}
                onChange={(d) => setStartsAt(dateToLocalInput(d))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ends_at">{t('FIELD_ENDS_AT_LABEL')}</Label>
              <DatePicker
                granularity="minute"
                value={localInputToDate(endsAt)}
                onChange={(d) => setEndsAt(dateToLocalInput(d))}
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
                value={note}
                onChange={(e) => setNote(e.target.value)}
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
            {t('CREATE_SUBMIT')}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
