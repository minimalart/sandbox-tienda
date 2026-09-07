import { Button, Drawer, Heading, Input, Label, Switch, Text, Textarea, toast } from '@medusajs/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateBrand } from '../../../hooks/api';
import { registerBrandsTranslations } from '../../../translations/brands';
import { SalesChannelMultiSelect } from '@minimalart/mercatto-plugin-runtime/admin';

export const BrandCreateDrawer = () => {
  const { t, i18n } = useTranslation('brands');
  registerBrandsTranslations(i18n);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [salesChannelIds, setSalesChannelIds] = useState<string[]>([]);

  const { mutateAsync: createBrand, isPending } = useCreateBrand({
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
    setName('');
    setHandle('');
    setDescription('');
    setIsActive(true);
    setSalesChannelIds([]);
  };

  const generateHandle = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!handle || handle === generateHandle(name)) {
      setHandle(generateHandle(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !handle) {
      toast.error(t('VALIDATION_REQUIRED'));
      return;
    }
    await createBrand({
      name,
      handle,
      description: description || undefined,
      is_active: isActive,
      sales_channel_ids: salesChannelIds.length ? salesChannelIds : null,
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
        <Drawer.Body className="p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t('FIELD_NAME_LABEL')}</Label>
              <Input
                id="name"
                placeholder={t('FIELD_NAME_PLACEHOLDER')}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="handle">{t('FIELD_HANDLE_LABEL')}</Label>
              <Input
                id="handle"
                placeholder={t('FIELD_HANDLE_PLACEHOLDER')}
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                required
              />
              <Text size="small" className="text-ui-fg-subtle">
                {t('FIELD_HANDLE_HELP')}
              </Text>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">{t('FIELD_DESCRIPTION_LABEL')}</Label>
              <Textarea
                id="description"
                placeholder={t('FIELD_DESCRIPTION_PLACEHOLDER')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_active">{t('FIELD_ACTIVE_LABEL')}</Label>
                <Text size="small" className="text-ui-fg-subtle">
                  {t('FIELD_ACTIVE_HELP')}
                </Text>
              </div>
              <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="border-t pt-4">
              <SalesChannelMultiSelect
                value={salesChannelIds}
                onChange={setSalesChannelIds}
                label="Canales de venta"
                help="Vacío = visible en todos los canales."
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
