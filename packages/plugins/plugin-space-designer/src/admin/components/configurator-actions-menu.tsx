import { EllipsisHorizontal, PencilSquare, Trash } from '@medusajs/icons';
import { DropdownMenu, IconButton, usePrompt } from '@medusajs/ui';
import type { SpaceConfigurator } from '../../types';

/** Row actions for a space, in the dots menu every other extension uses. */
export function ConfiguratorActionsMenu({
  configurator,
  onEdit,
  onDelete,
  deleting,
}: {
  configurator: SpaceConfigurator;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const prompt = usePrompt();
  async function remove() {
    const confirmed = await prompt({
      title: 'Eliminar espacio',
      description: `¿Seguro que querés eliminar “${configurator.title}”? Dejará de estar disponible en la tienda.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (confirmed) onDelete();
  }
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton variant="transparent" disabled={deleting} aria-label="Acciones del espacio">
          <EllipsisHorizontal />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item className="gap-x-2" onClick={onEdit}>
          <PencilSquare className="text-ui-fg-subtle" />
          Editar
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item className="gap-x-2 text-ui-fg-error" onClick={() => void remove()}>
          <Trash className="text-ui-fg-error" />
          Eliminar
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
