import { ArrowPath, EllipsisHorizontal, EyeMini, PencilSquare, Trash } from '@medusajs/icons';
import { DropdownMenu, IconButton, toast, usePrompt } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import {
  Ga4Builtin,
  Ga4Mapping,
  useDeleteGa4Mapping,
  useUpdateGa4Builtin,
} from '../../../hooks/api/ga4-mappings';
import { registerGa4EventsTranslations } from '../../../translations/ga4-events';

interface EventActionsMenuProps {
  kind: 'generic' | 'builtin' | 'readonly';
  mapping?: Ga4Mapping;
  builtin?: Ga4Builtin;
  onEdit: (mapping: Ga4Mapping) => void;
  onEditBuiltin: (builtin: Ga4Builtin) => void;
  onView: () => void;
}

/**
 * Menú de acciones (⋮) unificado para las 3 filas de la tabla de eventos. Solo
 * dispara los setters de estado de la página — NO monta drawers propios, así
 * el único drawer de edición vive en la página (evita el problema del doble
 * drawer que tenía MappingActionsMenu).
 */
export const EventActionsMenu = ({
  kind,
  mapping,
  builtin,
  onEdit,
  onEditBuiltin,
  onView,
}: EventActionsMenuProps) => {
  const { t, i18n } = useTranslation('ga4Events');
  registerGa4EventsTranslations(i18n);
  const prompt = usePrompt();

  const { mutateAsync: deleteMapping } = useDeleteGa4Mapping(mapping?.id ?? '', {
    onSuccess: () => {
      toast.success(t('DELETE_SUCCESS'));
    },
    onError: (error) => {
      toast.error(t('DELETE_ERROR', { msg: error.message }));
    },
  });

  const { mutateAsync: updateBuiltin } = useUpdateGa4Builtin(builtin?.builtin_key ?? '', {
    onError: (error) => {
      toast.error(t('UPDATE_ERROR', { msg: error.message }));
    },
  });

  const handleDelete = async () => {
    if (!mapping) return;
    const confirmed = await prompt({
      title: t('DELETE_PROMPT_TITLE'),
      description: t('DELETE_PROMPT_DESCRIPTION', { event: mapping.medusa_event }),
      confirmText: t('DELETE_PROMPT_CONFIRM'),
      cancelText: t('DELETE_PROMPT_CANCEL'),
    });

    if (confirmed) {
      await deleteMapping();
    }
  };

  // Un builtin no se borra: se "oculta" (soft-delete). Deja de listarse y de
  // dispararse, pero se puede restaurar en cualquier momento.
  const handleHideBuiltin = async () => {
    if (!builtin) return;
    const confirmed = await prompt({
      title: t('HIDE_BUILTIN_PROMPT_TITLE'),
      description: t('HIDE_BUILTIN_PROMPT_DESC'),
      confirmText: t('DELETE_PROMPT_CONFIRM'),
      cancelText: t('DELETE_PROMPT_CANCEL'),
    });

    if (confirmed) {
      await updateBuiltin({ hidden: true });
      toast.success(t('HIDE_BUILTIN_SUCCESS'));
    }
  };

  const handleRestoreBuiltin = async () => {
    if (!builtin) return;
    await updateBuiltin({ hidden: false });
    toast.success(t('RESTORE_SUCCESS'));
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <IconButton size="small" variant="transparent">
            <EllipsisHorizontal />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          {kind === 'generic' && mapping && (
            <>
              <DropdownMenu.Item className="gap-x-2" onClick={() => onEdit(mapping)}>
                <PencilSquare className="text-ui-fg-subtle" />
                {t('ACTION_EDIT')}
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item className="gap-x-2 text-ui-fg-error" onClick={handleDelete}>
                <Trash className="text-ui-fg-error" />
                {t('ACTION_DELETE')}
              </DropdownMenu.Item>
            </>
          )}
          {kind === 'builtin' && builtin && !builtin.hidden && (
            <>
              <DropdownMenu.Item className="gap-x-2" onClick={() => onEditBuiltin(builtin)}>
                <PencilSquare className="text-ui-fg-subtle" />
                {t('ACTION_EDIT')}
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item className="gap-x-2 text-ui-fg-error" onClick={handleHideBuiltin}>
                <Trash className="text-ui-fg-error" />
                {t('ACTION_DELETE')}
              </DropdownMenu.Item>
            </>
          )}
          {kind === 'builtin' && builtin && builtin.hidden && (
            <DropdownMenu.Item className="gap-x-2" onClick={handleRestoreBuiltin}>
              <ArrowPath className="text-ui-fg-subtle" />
              {t('ACTION_RESTORE')}
            </DropdownMenu.Item>
          )}
          {kind === 'readonly' && (
            <DropdownMenu.Item className="gap-x-2" onClick={onView}>
              <EyeMini className="text-ui-fg-subtle" />
              {t('ACTION_VIEW')}
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
};
