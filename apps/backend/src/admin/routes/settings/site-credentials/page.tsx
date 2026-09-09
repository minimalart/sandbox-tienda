import { VimeoCredentials, useVimeoCredentialStatus } from './components/vimeo-credentials';
import { getPluginMeta } from '@minimalart/mercatto-plugin-runtime/admin';
import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Alert,
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Text,
  Toaster,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { credentialErrorMessage, useSiteCredentials } from '../../../hooks/api/site-credentials';
import { useAppSettings } from '../../../hooks/api/app-settings';
import { useActiveSite } from '../../../hooks/use-active-site';
import { settingsNamespaces } from '../../../../modules/app-settings/descriptors';
import {
  SITE_ACCOUNT_KEYS,
  credentialIntegrationId,
  isCredentialSetting,
  isGlobalCredential,
  isGlobalIntegration,
} from '../../../../modules/app-settings/credential-presentation';
import { CredentialsSkeleton } from './components/credentials-skeleton';
import { IntegrationCard } from './components/integration-card';
import { ErpCredentials, useErpCredentialStatus } from './components/erp-credentials';
import { IntegrationLogo } from './components/integration-logo';
import { NoActiveSiteView } from './components/no-active-site';
import { UnknownIntegrations } from './components/unknown-integrations';
import { SingleColumnLayout } from '../../../components/layouts/single-column';

const SiteCredentialsPage = () => {
  const { activeId: selectedSiteId, activeSite, isPending } = useActiveSite();
  const location = useLocation();
  const navigate = useNavigate();
  const hash = location.hash;
  const globalView = !selectedSiteId || hash === '#globales' || hash.startsWith('#globales/') || isGlobalIntegration(hash.slice(1));
  const activeId = globalView ? null : selectedSiteId;
  return (
    <>
      <SiteScopeBar
        screen="site-credentials"
        reloadOnChange={false}
        variant="card"
        allowInstance
        instanceLabel="Todas"
        instanceSelected={globalView}
        onSiteChange={(siteId) => navigate({
          pathname: location.pathname,
          search: location.search,
          hash: siteId ? '' : 'globales',
        })}
      />
      {isPending && !globalView ? (
        <CredentialsSkeleton />
      ) : (
        <Content
          key={activeId ?? 'global'}
          siteId={activeId}
          isMainSite={activeSite?.is_main ?? false}
        />
      )}
      <Toaster />
    </>
  );
};

const Content = ({ siteId, isMainSite }: { siteId: string | null; isMainSite: boolean }) => {
  const { data, isPending, error } = useSiteCredentials(siteId);

  const erp = useErpCredentialStatus(
    settingsNamespaces.some((ns) => ns.namespace === 'extension:erp')
  );
  const vimeo = useVimeoCredentialStatus(
    settingsNamespaces.some((ns) => ns.namespace === 'extension:videos')
  );
  const location = useLocation();
  const navigate = useNavigate();
  const selected = location.hash.slice(1).replace(/^globales\//, '');
  const globalSelected = siteId === null;
  const settings = useAppSettings(undefined, globalSelected ? null : siteId);
  const [search, setSearch] = useState('');
  const open = (id: string) =>
    navigate({ pathname: location.pathname, search: location.search, hash: globalSelected ? `globales/${id}` : id });
  const close = () =>
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: globalSelected ? 'globales' : '',
      },
      { replace: true }
    );
  const entries = useMemo(() => {
    const siteEntries = settingsNamespaces
      .filter((ns) => !isGlobalIntegration(credentialIntegrationId(ns.namespace)))
      .map((ns) => ({
        id: credentialIntegrationId(ns.namespace),
        label: ns.title,
        namespace: ns.namespace,
        keys: ns.settings
          .filter((d) => isCredentialSetting(d) && !isGlobalCredential(d))
          .map((d) => d.key),
      }));
    for (const integration of data?.integrations ?? []) {
      if (isGlobalIntegration(integration.integration)) continue;
      const existing = siteEntries.find((e) => e.id === integration.integration);
      if (existing) existing.label = integration.label;
      else
        siteEntries.push({
          id: integration.integration,
          label: integration.label,
          namespace: '',
          keys: [],
        });
    }
    for (const [id, label] of Object.entries({
      'abandoned-cart': 'Carritos abandonados',
      banners: 'Banners',
      blog: 'Blog',
      brands: 'Marcas',
      comments: 'Comentarios',
      'commerce-dashboard': 'Panel comercial',
      contact: 'Contacto',
      'database-explorer': 'Explorador de datos',
      'dynamic-groups': 'Grupos dinámicos',
      'media-library': 'Biblioteca de medios',
      'shop-by-looks': 'Compra por looks',
      'space-designer': 'Diseñador de espacios',
      wishlist: 'Favoritos',
      loyalty: 'Fidelización',
      'pdf-catalog': 'Catálogos PDF',
    })) {
      if (getPluginMeta(id) && !siteEntries.some((e) => e.id === id))
        siteEntries.push({ id, label, namespace: '', keys: [] });
    }
    return siteEntries.sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [data]);
  const globals = settingsNamespaces.flatMap((ns) => {
    const keys = ns.settings.filter(isGlobalCredential);
    if (ns.namespace !== 'extension:ai-assistant') {
      return keys.length
        ? [
            {
              id: credentialIntegrationId(ns.namespace),
              label: ns.namespace === 'extension:fiscal-documentation' ? 'ARCA / AFIP' : ns.title,
              namespace: ns.namespace,
              keys: keys.map((d) => d.key),
            },
          ]
        : [];
    }
    return ['openrouter', 'embeddings'].flatMap((id) => {
      const selectedKeys = keys
        .filter((d) => d.key.startsWith(id.toUpperCase() + '_'))
        .map((d) => d.key);
      return selectedKeys.length
        ? [
            {
              id,
              label: id === 'openrouter' ? 'OpenRouter' : 'Embeddings',
              namespace: ns.namespace,
              keys: selectedKeys,
            },
          ]
        : [];
    });
  });
  const allEntries = [...new Map([...entries, ...globals].map((entry) => [entry.id, entry])).values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  const canAccess = (entry: (typeof entries)[number]) =>
    isGlobalIntegration(entry.id) === globalSelected;
  const selectedEntry = allEntries.find((entry) => entry.id === selected && canAccess(entry));
  const integration = globalSelected
    ? undefined
    : data?.integrations.find((e) => e.integration === selected);
  const configKeys = (entry: (typeof entries)[number]) =>
    ['openrouter', 'embeddings'].includes(entry.id) ? [] : settingsNamespaces.find((ns) => ns.namespace === entry.namespace)?.settings
      .filter((d) => !isCredentialSetting(d) && (!globalSelected || d.scope === 'instance'))
      .map((d) => d.key) ?? [];
  const selectedConfigKeys = selectedEntry ? configKeys(selectedEntry) : [];
  const stateOf = (entry: (typeof entries)[number]) => {
    if (entry.id === 'videos')
      return vimeo.isPending
        ? 'Cargando'
        : vimeo.isError
          ? 'No disponible'
          : vimeo.data?.connected
            ? 'Conectada'
            : 'Sin conectar';
    if (entry.id === 'erp')
      return erp.isPending
        ? 'Cargando'
        : erp.isError
          ? 'No disponible'
          : erp.data?.config?.credentials_set
            ? 'Conectada'
            : 'Sin conectar';
    const account = isGlobalIntegration(entry.id)
      ? undefined
      : data?.integrations.find((e) => e.integration === entry.id);
    if (account?.writable && !data?.site) return 'Elegí una tienda';
    if (account?.writable && data?.site)
      return !account.decryptable
        ? 'Revisar conexión'
        : account.effective_source !== 'none'
          ? 'Conectada'
          : 'Sin conectar';
    const fields =
      settings.data?.settings.filter(
        (s) => s.namespace === entry.namespace && entry.keys.includes(s.key)
      ) ?? [];
    if (fields.some((s) => s.decryptable === false)) return 'Revisar conexión';
    const secrets =
      settingsNamespaces
        .find((ns) => ns.namespace === entry.namespace)
        ?.settings.filter(
          (d) => entry.keys.includes(d.key) && (d.type === 'secret' || d.required)
        ) ?? [];
    if (!entry.keys.length && configKeys(entry).length && !account?.writable) return 'Configuración';
    if (!entry.keys.length)
      return account?.effective_source !== 'none' && account ? 'Conectada' : 'Sin credenciales';
    if (settings.isPending) return 'Cargando';
    if (settings.isError) return 'No disponible';
    if (
      entry.id === 'embeddings' &&
      settings.data?.settings.some(
        (s) =>
          s.namespace === entry.namespace &&
          s.key === 'OPENROUTER_API_KEY' &&
          !['unset', 'off', 'default'].includes(s.source) &&
          s.decryptable !== false
      )
    )
      return 'Conectada';
    const required = secrets.filter((d) => d.required);
    const checked = required.length ? required : secrets;
    const usable = (key: string) =>
      fields.some(
        (s) =>
          s.key === key &&
          !['unset', 'off', 'default'].includes(s.source) &&
          s.decryptable !== false
      );
    return checked.length &&
      (required.length ? checked.every((d) => usable(d.key)) : checked.some((d) => usable(d.key)))
      ? 'Conectada'
      : 'Sin conectar';
  };
  const visible = allEntries.filter((e) =>
    [e.label, ...(settingsNamespaces.find((ns) => ns.namespace === e.namespace)?.settings
      .filter((d) => e.keys.includes(d.key) || configKeys(e).includes(d.key))
      .flatMap((d) => [d.label, d.key, d.help ?? '']) ?? [])]
      .some((text) => text.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  );

  return (
    <SingleColumnLayout>
      <Container className="p-0">
        <div className="flex flex-col gap-y-4 px-6 py-4">
          <div>
            <Heading>Integraciones</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Administrá las credenciales y la configuración de cada integración.
            </Text>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Input
              aria-label="Buscar integración"
              placeholder="Buscar integración…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
          {globalSelected && (
            <Text size="small" className="text-ui-fg-subtle">
              Con «Todas» podés administrar los servicios globales. Elegí una tienda para acceder a sus integraciones.
            </Text>
          )}
        </div>
        {(globalSelected ? settings.isPending : isPending) ? (
          <CredentialsSkeleton />
        ) : (
          <div className="divide-y border-t">
            {visible.map((entry) => {
              const accessible = canAccess(entry);
              const status = accessible ? stateOf(entry) : isGlobalIntegration(entry.id) ? 'Seleccioná Todas' : 'Seleccioná una tienda';
              return (
                <button
                  key={entry.id}
                  id={entry.id}
                  type="button"
                  disabled={!accessible}
                  onClick={() => open(entry.id)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left text-ui-fg-base transition-colors enabled:hover:bg-ui-bg-subtle disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ui-border-interactive"
                  aria-label={`Configurar ${entry.label}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <IntegrationLogo id={entry.id} label={entry.label} />
                    <span className="txt-small-plus">{entry.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <Badge
                      size="2xsmall"
                      color={
                        status === 'Conectada'
                          ? 'green'
                          : status === 'Revisar conexión'
                            ? 'red'
                            : 'grey'
                      }
                    >
                      {status}
                    </Badge>
                    <span aria-hidden="true">{accessible ? '›' : '—'}</span>
                  </span>
                </button>
              );
            })}
            {!visible.length && (
              <Text className="px-6 py-6 text-ui-fg-subtle">
                No hay integraciones para esta búsqueda.
              </Text>
            )}
          </div>
        )}
      </Container>
      {!globalSelected && error && (
        <Alert variant="error">{credentialErrorMessage(error)}</Alert>
      )}
      {settings.isError && (
        <Alert variant="error">
          No se pudo consultar el estado de las conexiones.{' '}
          <Button variant="secondary" size="small" onClick={() => void settings.refetch()}>
            Reintentar
          </Button>
        </Alert>
      )}
      {!globalSelected && data && !data.site && <NoActiveSiteView data={data} />}
      {!globalSelected && data?.site && (
        <UnknownIntegrations rows={data.unknown_integrations ?? []} siteName={data.site.name} />
      )}
      <Drawer
        open={Boolean(selectedEntry)}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{selectedEntry?.label}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
            {selectedEntry && (
              <>
                <div className="flex items-center gap-3">
                  <IntegrationLogo id={selectedEntry.id} label={selectedEntry.label} />
                  <Text weight="plus">{selectedEntry.label}</Text>
                </div>
                <Text size="small" className="text-ui-fg-subtle">
                  El estado indica que hay credenciales configuradas; no verifica el acceso al
                  proveedor.
                </Text>
                {(selectedEntry.keys.length > 0 || integration?.writable || (selected === 'erp' && !globalSelected) || selected === 'videos') && (
                  <Heading level="h2">Credenciales</Heading>
                )}
                {selected === 'videos' && <VimeoCredentials />}
                {selectedEntry.keys.length > 0 &&
                  settingsNamespaces
                    .find((ns) => ns.namespace === selectedEntry.namespace)
                    ?.settings.filter((d) => selectedEntry.keys.includes(d.key))
                    .every((d) => d.scope === 'instance') && (
                    <Text size="small" className="text-ui-fg-subtle">
                      Esta configuración se comparte entre todas las tiendas.
                    </Text>
                  )}
                {selected === 'erp' && !globalSelected ? (
                  <ErpCredentials />
                ) : !globalSelected && SITE_ACCOUNT_KEYS[selected] && !integration ? (
                  <Text>
                    {isPending
                      ? 'Cargando la cuenta de la tienda…'
                      : 'No se pudo cargar la cuenta. Cerrá el detalle y volvé a intentarlo.'}
                  </Text>
                ) : integration?.writable ? (
                  data?.site ? (
                    <>
                      <IntegrationCard
                        key={`${siteId}:${selected}`}
                        integration={integration}
                        siteId={siteId}
                        siteName={data.site.name}
                        isMainSite={isMainSite}
                      />
                      <ExtensionSettingsCard
                        siteId={siteId}
                        namespace={selectedEntry.namespace}
                        only={selectedEntry.keys.filter(
                          (key) => !(SITE_ACCOUNT_KEYS[selected] ?? []).includes(key)
                        )}
                        credentials
                        hideHeader
                        hideSiteContext
                      />
                    </>
                  ) : (
                    <Text>Seleccioná una tienda para administrar esta cuenta.</Text>
                  )
                ) : selectedEntry.keys.length ? (
                  <ExtensionSettingsCard
                        siteId={siteId}
                    key={`${siteId}:${selected}`}
                    namespace={selectedEntry.namespace}
                    only={selectedEntry.keys}
                    credentials
                    hideHeader
                    hideSiteContext
                  />
                ) : integration ? (
                  data?.site ? (
                    <IntegrationCard
                      integration={integration}
                      siteId={siteId}
                      siteName={data.site.name}
                      isMainSite={isMainSite}
                    />
                  ) : (
                    <Text>Seleccioná una tienda para administrar esta cuenta.</Text>
                  )
                ) : selectedConfigKeys.length ? null : (
                  <Text size="small" className="text-ui-fg-subtle">
                    Esta extensión no requiere credenciales propias. Los proveedores compartidos se
                    administran seleccionando «Todas» en el selector de tienda.
                  </Text>
                )}
                {selectedConfigKeys.length > 0 && (
                  <section className="flex flex-col gap-3 border-t pt-4">
                    <Heading level="h2">Configuración</Heading>
                    <ExtensionSettingsCard
                      key={`config:${siteId}:${selected}`}
                      siteId={siteId}
                      namespace={selectedEntry.namespace}
                      only={selectedConfigKeys}
                      hideHeader
                      hideSiteContext
                    />
                  </section>
                )}
              </>
            )}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </SingleColumnLayout>
  );
};

export const config = defineRouteConfig({ label: 'Integraciones', rank: 21 });
export const handle = { breadcrumb: () => 'Integraciones' };
export default SiteCredentialsPage;
