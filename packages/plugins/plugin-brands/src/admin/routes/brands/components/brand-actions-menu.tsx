import { EllipsisHorizontal, PencilSquare, Trash } from '@medusajs/icons';
import { DropdownMenu, IconButton, toast, usePrompt } from '@medusajs/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brand, useDeleteBrand } from '../../../hooks/api';
import { registerBrandsTranslations } from '../../../translations/brands';
import { BrandEditDrawer } from './brand-edit-drawer';

interface BrandActionsMenuProps {
  brand: Brand;
}

export const BrandActionsMenu = ({ brand }: BrandActionsMenuProps) => {
  const { t, i18n } = useTranslation('brands');
  registerBrandsTranslations(i18n);
  const prompt = usePrompt();
  const [editOpen, setEditOpen] = useState(false);

  const { mutateAsync: deleteBrand } = useDeleteBrand(brand.id, {
    onSuccess: () => {
      toast.success(t('DELETE_SUCCESS'));
    },
    onError: (error) => {
      toast.error(t('DELETE_ERROR', { msg: error.message }));
    },
  });

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: t('DELETE_PROMPT_TITLE'),
      description: t('DELETE_PROMPT_DESCRIPTION', { name: brand.name }),
      confirmText: t('DELETE_PROMPT_CONFIRM'),
      cancelText: t('DELETE_PROMPT_CANCEL'),
    });

    if (confirmed) {
      await deleteBrand();
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
      <BrandEditDrawer brand={brand} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
};
