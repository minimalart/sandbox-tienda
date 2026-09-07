import { EllipsisHorizontal, PencilSquare, Trash } from '@medusajs/icons';
import { DropdownMenu, IconButton, toast, usePrompt } from '@medusajs/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShopByLook, useDeleteShopByLook } from '../../../hooks/api';
import { registerShopByLooksTranslations } from '../../../translations/shop-by-looks';
import { ShopByLookFormDrawer } from './shop-by-look-form-drawer';

interface Props {
  look: ShopByLook;
}

export const ShopByLookActionsMenu = ({ look }: Props) => {
  const { t, i18n } = useTranslation('shop-by-looks');
  registerShopByLooksTranslations(i18n);
  const prompt = usePrompt();
  const [editOpen, setEditOpen] = useState(false);

  const { mutateAsync: deleteLook } = useDeleteShopByLook(look.id, {
    onSuccess: () => toast.success(t('DELETE_SUCCESS')),
    onError: (error) => toast.error(t('DELETE_ERROR', { msg: error.message })),
  });

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: t('ACTION_DELETE'),
      description: t('DELETE_CONFIRM'),
      confirmText: t('ACTION_DELETE'),
      cancelText: t('CANCEL'),
    });
    if (confirmed) {
      await deleteLook();
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <IconButton variant="transparent">
            <EllipsisHorizontal />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item className="gap-x-2" onClick={() => setEditOpen(true)}>
            <PencilSquare className="text-ui-fg-subtle" />
            {t('ACTION_EDIT')}
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item className="gap-x-2 text-ui-fg-error" onClick={handleDelete}>
            <Trash className="text-ui-fg-error" />
            {t('ACTION_DELETE')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
      <ShopByLookFormDrawer look={look} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
};
