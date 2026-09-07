import { EllipsisHorizontal, PencilSquare, SquareTwoStack, Trash } from '@medusajs/icons';
import { DropdownMenu, IconButton, toast, usePrompt } from '@medusajs/ui';
import {
  type CheckoutLink,
  useDeleteCheckoutLink,
  useUpdateCheckoutLink,
} from '../../../hooks/api/checkout-links';

type Props = {
  link: CheckoutLink;
  onEdit: () => void;
};

/** Row actions for a checkout link: view/edit, copy URL, enable/disable, delete. */
export function CheckoutLinkActionsMenu({ link, onEdit }: Props) {
  const prompt = usePrompt();
  const update = useUpdateCheckoutLink(link.id);
  const remove = useDeleteCheckoutLink();

  const isDisabled = link.status === 'disabled';
  const publicUrl = link.public_url || `/${link.country_code}/c/${link.token}`;

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('URL copiada al portapapeles');
    } catch {
      toast.error('No se pudo copiar la URL');
    }
  }

  function toggleDisabled() {
    update.mutate(
      { status: isDisabled ? 'active' : 'disabled' },
      {
        onSuccess: () =>
          toast.success(isDisabled ? 'Link reactivado' : 'Link deshabilitado'),
        onError: (e: any) => toast.error(e.message),
      },
    );
  }

  async function handleDelete() {
    const confirmed = await prompt({
      title: 'Eliminar link de venta',
      description: `¿Seguro que querés eliminar "${link.internal_name || link.token}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    remove.mutate(link.id, {
      onSuccess: () => toast.success('Link eliminado'),
      onError: (e: any) => toast.error(e.message),
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton variant="transparent">
          <EllipsisHorizontal />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item className="gap-x-2" onClick={onEdit}>
          <PencilSquare className="text-ui-fg-subtle" />
          Ver / Editar
        </DropdownMenu.Item>
        <DropdownMenu.Item className="gap-x-2" onClick={copyUrl}>
          <SquareTwoStack className="text-ui-fg-subtle" />
          Copiar URL
        </DropdownMenu.Item>
        <DropdownMenu.Item className="gap-x-2" onClick={toggleDisabled}>
          <PencilSquare className="text-ui-fg-subtle" />
          {isDisabled ? 'Reactivar' : 'Deshabilitar'}
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          className="gap-x-2 text-ui-fg-error"
          onClick={handleDelete}
        >
          <Trash className="text-ui-fg-error" />
          Eliminar
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
