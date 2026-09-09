import { ArrowUturnLeft, EllipsisHorizontal, Trash } from '@medusajs/icons';
import { DropdownMenu, IconButton, toast, usePrompt } from '@medusajs/ui';
import {
  type CatalogingExecution,
  useDeleteExecution,
  useUndeleteExecution,
} from '../../hooks/api';

type Props = {
  execution: CatalogingExecution;
  /** true en la papelera: la única acción es devolverla al listado. */
  trash?: boolean;
};

/**
 * Menú de fila del listado de corridas: eliminar (borrado lógico) o restaurar.
 *
 * Por qué el item bloqueado se muestra DESHABILITADO y no se esconde: sin él, una
 * corrida aplicada y una borrable se ven idénticas y el operador concluye que el
 * borrado no existe —que es justo el reporte con el que arrancó esto—. Con el item
 * gris y el motivo arriba, la pantalla contesta la pregunta sola.
 *
 * Quién puede borrar lo decide el BACKEND: `deletable` y `delete_block_reason`
 * vienen calculados por fila. Acá no hay ninguna lista de estados.
 */
export function ExecutionActionsMenu({ execution, trash = false }: Props) {
  const prompt = usePrompt();
  const remove = useDeleteExecution();
  const undelete = useUndeleteExecution();

  async function handleDelete() {
    const confirmed = await prompt({
      title: 'Eliminar corrida',
      description:
        `¿Eliminar "${execution.name}"? Sale del listado y queda en la papelera, ` +
        'desde donde la podés recuperar. No se toca ningún producto del catálogo.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    remove.mutate(execution.id, {
      onSuccess: () => toast.success('Corrida enviada a la papelera'),
      onError: (e: unknown) =>
        toast.error((e as { message?: string })?.message ?? 'No se pudo eliminar'),
    });
  }

  function handleUndelete() {
    undelete.mutate(
      { id: execution.id },
      {
        onSuccess: () => toast.success('Corrida restaurada al listado'),
        onError: (e: unknown) =>
          toast.error((e as { message?: string })?.message ?? 'No se pudo restaurar'),
      }
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton variant="transparent" aria-label="Acciones de la corrida">
          <EllipsisHorizontal />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {trash ? (
          <DropdownMenu.Item
            className="gap-x-2"
            disabled={undelete.isPending}
            onClick={handleUndelete}
          >
            <ArrowUturnLeft className="text-ui-fg-subtle" />
            Restaurar al listado
          </DropdownMenu.Item>
        ) : (
          <>
            {!execution.deletable && execution.delete_block_reason ? (
              <>
                <DropdownMenu.Label className="max-w-72 whitespace-normal text-pretty">
                  {execution.delete_block_reason}
                </DropdownMenu.Label>
                <DropdownMenu.Separator />
              </>
            ) : null}
            <DropdownMenu.Item
              className="gap-x-2 text-ui-fg-error"
              disabled={!execution.deletable || remove.isPending}
              onClick={handleDelete}
            >
              <Trash className="text-ui-fg-error" />
              Eliminar
            </DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
