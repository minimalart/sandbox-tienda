import {
  ArrowDownTray,
  EllipsisHorizontal,
  PencilSquare,
  SquareTwoStack,
  Trash,
} from '@medusajs/icons';
import { DropdownMenu, IconButton, toast, usePrompt } from '@medusajs/ui';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../../lib/client';
import {
  bundlesQueryKeys,
  useDeleteBundle,
  usePublishBundle,
  type Bundle,
} from '../../../hooks/api/bundles';
import { registerBundlesTranslations } from '../../../translations/bundles';

interface BundleActionsMenuProps {
  bundle: Bundle;
}

/**
 * Actions per row para el listado de Bundles. Cubre las acciones de PRD §30:
 * Edit / Duplicate / Publish|Unpublish / Delete. "Actions siempre visibles"
 * (§30) — implementado como DropdownMenu con IconButton disparador, mismo
 * patrón que `StoreLocationActionsMenu` y el resto del admin.
 *
 * Duplicate se resuelve client-side: POST /admin/bundles con el título
 * sufijado " (copia)" y el handle con "-copia" — el operador termina de
 * pulirlo en el detail. Sin persistencia del listado de items ni de las
 * stores, para no arrastrar side-effects inesperados.
 */
export const BundleActionsMenu = ({ bundle }: BundleActionsMenuProps) => {
  const { t, i18n } = useTranslation('bundles');
  registerBundlesTranslations(i18n);
  const prompt = usePrompt();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const isPublished = bundle.status === 'published';

  const { mutateAsync: publish } = usePublishBundle(bundle.id, {
    onSuccess: () => toast.success(t('ACTION_PUBLISH')),
    onError: (err) => toast.error(err.message),
  });

  const { mutateAsync: unpublish } = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ bundle: Bundle }>(`/admin/bundles/${bundle.id}/unpublish`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bundlesQueryKeys.lists() });
      qc.invalidateQueries({ queryKey: bundlesQueryKeys.detail(bundle.id) });
      toast.success(t('ACTION_UNPUBLISH'));
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const { mutateAsync: duplicate } = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ bundle: Bundle }>('/admin/bundles', {
        method: 'POST',
        body: {
          title: `${bundle.title} (copia)`,
          // Handle único: sufijo -copia (y sufijo con timestamp corto si ya
          // existe uno con -copia). El operador puede cambiarlo en el detail.
          handle: `${bundle.handle}-copia-${Date.now().toString(36).slice(-4)}`,
          description: bundle.description ?? null,
          thumbnail: bundle.thumbnail ?? null,
          status: 'draft',
        },
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: bundlesQueryKeys.lists() });
      toast.success(t('ACTION_DUPLICATE'));
      navigate(`/bundles/${data.bundle.id}`);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const { mutateAsync: deleteBundle } = useDeleteBundle({
    onSuccess: () => toast.success(t('ACTION_DELETE')),
    onError: (err) => toast.error(err.message),
  });

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: t('ACTION_DELETE'),
      description: bundle.title,
      confirmText: t('ACTION_DELETE'),
      cancelText: 'Cancelar',
    });
    if (confirmed) await deleteBundle(bundle.id);
  };

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton variant="transparent" aria-label="Actions">
          <EllipsisHorizontal />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item className="gap-x-2" onClick={() => navigate(`/bundles/${bundle.id}`)}>
          <PencilSquare className="text-ui-fg-subtle" />
          {t('ACTION_EDIT')}
        </DropdownMenu.Item>
        <DropdownMenu.Item className="gap-x-2" onClick={() => duplicate()}>
          <SquareTwoStack className="text-ui-fg-subtle" />
          {t('ACTION_DUPLICATE')}
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        {isPublished ? (
          <DropdownMenu.Item className="gap-x-2" onClick={() => unpublish()}>
            <ArrowDownTray className="text-ui-fg-subtle" />
            {t('ACTION_UNPUBLISH')}
          </DropdownMenu.Item>
        ) : (
          <DropdownMenu.Item className="gap-x-2" onClick={() => publish()}>
            <ArrowDownTray className="text-ui-fg-subtle rotate-180" />
            {t('ACTION_PUBLISH')}
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Separator />
        <DropdownMenu.Item className="gap-x-2 text-ui-fg-error" onClick={handleDelete}>
          <Trash className="text-ui-fg-error" />
          {t('ACTION_DELETE')}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};
