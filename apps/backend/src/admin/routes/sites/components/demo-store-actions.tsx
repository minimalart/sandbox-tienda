import { ArrowPath, ArrowUpRightOnBox, EllipsisHorizontal, Eye, PencilSquare, Photo, Trash, Window } from '@medusajs/icons';
import { DropdownMenu, IconButton, toast, usePrompt } from '@medusajs/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { type DemoStore, useDeleteDemoStore, useRetryDemoStoreImport } from '../../../hooks/api';
import { useStorefrontBase } from '../../../hooks/use-storefront-base';
import { buildPublicUrlFrom, SITE_HOST_SUFFIX } from '../lib';
import { DemoStoreEdit } from './demo-store-edit';

export const DemoStoreActions = ({ demo }: { demo: DemoStore }) => {
  const { t } = useTranslation('demo-stores');
  const navigate = useNavigate();
  const prompt = usePrompt();
  const [editOpen, setEditOpen] = useState(false);
  const storefrontBase = useStorefrontBase();

  const { mutateAsync: deleteDemo } = useDeleteDemoStore(demo.id, {
    onSuccess: () => toast.success(t('DELETE_SUCCESS')),
    onError: (error) => toast.error(t('DELETE_ERROR', { msg: error.message })),
  });

  const { mutate: retryImport } = useRetryDemoStoreImport(demo.id, {
    onSuccess: () => toast.success(t('RETRY_STARTED')),
    onError: (error) => toast.error(t('RETRY_ERROR', { msg: error.message })),
  });

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: t('ACTION_DELETE'),
      description: t('DELETE_CONFIRM'),
      confirmText: t('ACTION_DELETE'),
      cancelText: t('BACK'),
    });
    if (confirmed) await deleteDemo();
  };

  // La tienda principal no importa catálogo ni se elimina: el backend devuelve 409
  // en /retry y en DELETE, así que ofrecer los botones sería ofrecer un error.
  const isMain = Boolean(demo.is_main);
  const canRetry = !isMain && (demo.status === 'failed' || demo.status === 'ready');

  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <IconButton variant="transparent">
            <span className="sr-only">{t('COLUMN_ACTIONS')}</span>
            <EllipsisHorizontal />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item className="gap-x-2" onClick={() => navigate(`/sites/${demo.id}`)}>
            <Eye className="text-ui-fg-subtle" />
            {t('ACTION_VIEW')}
          </DropdownMenu.Item>
          <DropdownMenu.Item className="gap-x-2" onClick={() => setEditOpen(true)}>
            <PencilSquare className="text-ui-fg-subtle" />
            {t('ACTION_EDIT')}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="gap-x-2"
            onClick={() => navigate(`/sites/${demo.id}/home`)}
          >
            <Photo className="text-ui-fg-subtle" />
            {t('ACTION_CUSTOMIZE_HOME')}
          </DropdownMenu.Item>
          {/*
            El footer NO se edita con Puck como la home: es un layout fijo con slots
            conocidos, así que va a un formulario. El porqué está en el encabezado de
            `[id]/footer/page.tsx`.
          */}
          <DropdownMenu.Item
            className="gap-x-2"
            onClick={() => navigate(`/sites/${demo.id}/footer`)}
          >
            <Window className="text-ui-fg-subtle" />
            {t('ACTION_CUSTOMIZE_FOOTER')}
          </DropdownMenu.Item>
          {canRetry && (
            <DropdownMenu.Item className="gap-x-2" onClick={() => retryImport()}>
              <ArrowPath className="text-ui-fg-subtle" />
              {t('ACTION_RETRY')}
            </DropdownMenu.Item>
          )}
          {demo.status === 'ready' && (
            <DropdownMenu.Item
              className="gap-x-2"
              onClick={() =>
                window.open(
                  buildPublicUrlFrom(demo, {
                    baseUrl: storefrontBase,
                    hostSuffix: SITE_HOST_SUFFIX,
                  }),
                  '_blank',
                )
              }
            >
              <ArrowUpRightOnBox className="text-ui-fg-subtle" />
              {t('ACTION_OPEN')}
            </DropdownMenu.Item>
          )}
          {!isMain && (
            <>
              <DropdownMenu.Separator />
              <DropdownMenu.Item className="gap-x-2 text-ui-fg-error" onClick={handleDelete}>
                <Trash className="text-ui-fg-error" />
                {t('ACTION_DELETE')}
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
      <DemoStoreEdit demo={demo} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
};
