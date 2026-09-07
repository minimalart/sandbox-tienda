import { Button } from '@medusajs/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { registerShopByLooksTranslations } from '../../../translations/shop-by-looks';
import { ShopByLookFormDrawer } from './shop-by-look-form-drawer';

export const ShopByLookCreateButton = () => {
  const { t, i18n } = useTranslation('shop-by-looks');
  registerShopByLooksTranslations(i18n);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="small" onClick={() => setOpen(true)}>
        {t('CREATE_BUTTON')}
      </Button>
      <ShopByLookFormDrawer look={null} open={open} onOpenChange={setOpen} />
    </>
  );
};
