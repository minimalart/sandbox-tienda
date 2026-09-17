import { Puck, usePuck, type Data } from '@measured/puck';
import '@measured/puck/puck.css';
import { Button, Heading, Text, Toaster, toast } from '@medusajs/ui';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSettings, useUpdateAppSettings } from '../../../hooks/api/app-settings';
import { useStorefrontOrigins } from '../../../hooks/use-storefront-base';
import { directoryPuckConfig } from '../../../lib/puck/directory-config';
import {
  defaultDirectoryDocument,
  validateDirectoryDocument,
} from '../../../../modules/demo-store/directory-document';

// Arrow function y no declaración: lo exige el lint del admin de Medusa
// (`@medusajs/admin-component-must-be-arrow-function`), y con la declaración el
// `medusa build` de TODO el repo falla en el paso de lint.
const DirectoryEditor = () => {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useAppSettings('extension:multistore', null);
  const update = useUpdateAppSettings(null);
  const { base, sitesBase } = useStorefrontOrigins();
  const save = async (document: Data) => {
    const issue = validateDirectoryDocument(document);
    if (issue) {
      toast.error(issue);
      return;
    }
    try {
      await update.mutateAsync({
        namespace: 'extension:multistore',
        values: { SITES_HUB_PUCK: document },
      });
      toast.success(en ? 'Directory saved' : 'Directorio guardado');
    } catch {
      toast.error(en ? 'Could not save directory' : 'No se pudo guardar el directorio');
    }
  };
  const SaveButton = () => {
    const { appState } = usePuck();
    return (
      <Button size="small" isLoading={update.isPending} onClick={() => save(appState.data)}>
        {en ? 'Save changes' : 'Guardar cambios'}
      </Button>
    );
  };
  if (isLoading)
    return <Text className="p-12 text-ui-fg-subtle">{en ? 'Loading…' : 'Cargando…'}</Text>;
  if (isError)
    return (
      <div className="p-12">
        <Text>{en ? 'Could not load directory' : 'No se pudo cargar el directorio'}</Text>
        <Button variant="secondary" onClick={() => refetch()}>
          {en ? 'Retry' : 'Reintentar'}
        </Button>
      </div>
    );
  const saved = data?.settings.find((setting) => setting.key === 'SITES_HUB_PUCK')?.value;
  const document = saved && !validateDirectoryDocument(saved) ? saved : defaultDirectoryDocument;
  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-ui-border-base bg-ui-bg-base px-4 py-3">
        <div className="flex items-center gap-4">
          <Button size="small" variant="transparent" onClick={() => navigate('/sites')}>
            {en ? 'Back' : 'Volver'}
          </Button>
          <Heading level="h2">{en ? 'Store directory' : 'Directorio de tiendas'}</Heading>
        </div>
        <a
          className="text-sm text-ui-fg-interactive"
          href={sitesBase || `${base}/tiendas`}
          target="_blank"
          rel="noreferrer"
        >
          {en ? 'Preview ↗' : 'Vista previa ↗'}
        </a>
      </div>
      <div className="min-h-0 flex-1">
        <Puck
          config={directoryPuckConfig(i18n.language)}
          data={document as Data}
          onPublish={save}
          overrides={{ headerActions: () => <SaveButton /> }}
        />
      </div>
      <Toaster />
    </div>
  );
};

export default DirectoryEditor;
