import { Button, Drawer, Heading, Input, Label, Switch, Text, Textarea, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brand, useBrand, useUpdateBrand } from '../../../hooks/api';
import { registerBrandsTranslations } from '../../../translations/brands';
import { BrandImageSection } from '../[brand_id]/components/brand-image-section';
import { SalesChannelMultiSelect } from '@minimalart/mercatto-plugin-runtime/admin';

interface BrandEditDrawerProps {
  brand: Brand;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BrandEditDrawer = ({ brand, open, onOpenChange }: BrandEditDrawerProps) => {
  const { t, i18n } = useTranslation('brands');
  registerBrandsTranslations(i18n);

  // Trae el detalle fresco del backend al abrir (con fallback al objeto de la
  // tabla) para garantizar que el form siempre se popule con nombre/identificador
  // aunque el dato de la lista venga parcial o desactualizado.
  const { data: detail } = useBrand(brand.id, undefined, { enabled: open });
  const source = detail?.brand ?? brand;

  const [name, setName] = useState(brand.name);
  const [handle, setHandle] = useState(brand.handle);
  const [description, setDescription] = useState(brand.description || '');
  const [isActive, setIsActive] = useState(brand.is_active);
  const [salesChannelIds, setSalesChannelIds] = useState<string[]>(
    brand.sales_channel_ids ?? [],
  );

  const { mutateAsync: updateBrand, isPending } = useUpdateBrand(brand.id, {
    onSuccess: () => {
      toast.success(t('UPDATE_SUCCESS'));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(t('UPDATE_ERROR', { msg: error.message }));
    },
  });

  useEffect(() => {
    if (open) {
      setName(source.name ?? '');
      setHandle(source.handle ?? '');
      setDescription(source.description || '');
      setIsActive(source.is_active ?? true);
      setSalesChannelIds(source.sales_channel_ids ?? []);
    }
  }, [open, source]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !handle) {
      toast.error(t('VALIDATION_REQUIRED'));
      return;
    }
    await updateBrand({
      name,
      handle,
      description: description || undefined,
      is_active: isActive,
      sales_channel_ids: salesChannelIds.length ? salesChannelIds : null,
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Heading>{t('EDIT_TITLE')}</Heading>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-brand-name">{t('FIELD_NAME_LABEL')}</Label>
              <Input
                id="edit-brand-name"
                placeholder={t('FIELD_NAME_PLACEHOLDER')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-brand-handle">{t('FIELD_HANDLE_LABEL')}</Label>
              <Input
                id="edit-brand-handle"
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
              <Label htmlFor="edit-brand-description">{t('FIELD_DESCRIPTION_LABEL')}</Label>
              <Textarea
                id="edit-brand-description"
                placeholder={t('FIELD_DESCRIPTION_PLACEHOLDER')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="edit-brand-active">{t('FIELD_ACTIVE_LABEL')}</Label>
                <Text size="small" className="text-ui-fg-subtle">
                  {t('FIELD_ACTIVE_HELP')}
                </Text>
              </div>
              <Switch id="edit-brand-active" checked={isActive} onCheckedChange={setIsActive} />
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
          <div className="mt-6">
            <BrandImageSection brandId={brand.id} />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">{t('CANCEL')}</Button>
          </Drawer.Close>
          <Button onClick={handleSubmit} isLoading={isPending}>
            {t('EDIT_SUBMIT')}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
