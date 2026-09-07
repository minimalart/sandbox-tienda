import { EllipsisHorizontal, PencilSquare, Trash } from '@medusajs/icons';
import { DropdownMenu, IconButton, toast, usePrompt } from '@medusajs/ui';
import { useState } from 'react';
import { PdfCatalog, useDeletePdfCatalog } from '../../../hooks/api';
import { PdfCatalogFormDrawer } from './pdf-catalog-form-drawer';

interface Props {
  catalog: PdfCatalog;
}

export const PdfCatalogActionsMenu = ({ catalog }: Props) => {
  const prompt = usePrompt();
  const [editOpen, setEditOpen] = useState(false);

  const { mutateAsync: deleteCatalog } = useDeletePdfCatalog(catalog.id, {
    onSuccess: () => toast.success('Catálogo eliminado'),
    onError: (error) => toast.error(error.message),
  });

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: 'Eliminar catálogo',
      description: `¿Seguro que querés eliminar "${catalog.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (confirmed) await deleteCatalog();
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
            Editar
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item className="gap-x-2 text-ui-fg-error" onClick={handleDelete}>
            <Trash className="text-ui-fg-error" />
            Eliminar
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
      <PdfCatalogFormDrawer catalog={catalog} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
};
