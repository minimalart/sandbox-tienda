import { defineRouteConfig } from '@medusajs/admin-sdk';
import { CogSixTooth, PencilSquare, Trash } from '@medusajs/icons';
import {
  Badge,
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  Heading,
  Tabs,
  Text,
  toast,
  Toaster,
  useDataTable,
  usePrompt,
} from '@medusajs/ui';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getCurrentMinimumPurchase,
  type MinimumPurchase,
  useDeleteMinimumPurchase,
  useMinimumPurchases,
} from '../../hooks/api';
import { useActiveSite } from '../../hooks/use-active-site';
import { registerStoreConfigTranslations } from '../../translations/store-config';
import {
  MinimumPurchaseCreateDrawer,
  MinimumPurchaseEditDrawer,
} from './components/minimum-purchase-create-drawer';
import { BranchSettingsCard } from './components/branch-settings-card';
import { StorefrontSettingsCard } from './components/storefront-settings-card';
import { AiConfigCard } from './components/ai-config-card';
import { FiscalDocsTab } from './components/fiscal-docs-card';
import { SiteGateCard } from './components/site-gate-card';
import { LegalPagesCard } from './components/legal-pages-card';
import { CommerceCard } from './components/commerce-card';
import { CommerceContextCard } from './components/commerce-context-card';
import { ExtensionVersion } from '../../components/common/extension-version';
import { HelpDrawer } from '../../components/common/help-drawer';
import { SiteScopeBar } from '../../components/common/site-scope-bar';
import { ExtensionSettingsCard } from '../../components/app-settings/extension-settings-card';

const PAGE_SIZE = 20;

const columnHelper = createDataTableColumnHelper<MinimumPurchase>();

const formatDateTime = (value: string | null, locale: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleString(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
};

const formatAmount = (amount: number, currencyCode: string, locale: string) => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currencyCode.toUpperCase()}`;
  }
};

const StoreConfig = () => {
  const { t, i18n } = useTranslation('storeConfig');
  registerStoreConfigTranslations(i18n);
  const locale = i18n.language || 'es';

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useMinimumPurchases({ limit: pagination.pageSize, offset });

  // Separate, wider query to compute the currently effective minimum — the
  // visible page may not contain it.
  const { data: currentData } = useMinimumPurchases({ limit: 100, offset: 0 });
  const current = useMemo(
    () => getCurrentMinimumPurchase(currentData?.minimum_purchases ?? []),
    [currentData]
  );

  const minimumPurchases = data?.minimum_purchases ?? [];
  const count = data?.count ?? 0;

  // Con una tienda elegida la tabla mezcla su serie con la GLOBAL (la que hereda si
  // no tiene la suya). Editar o borrar una fila global desde una tienda se lo cambia
  // a todas las que heredan: la etiqueta es para que el operador lo sepa antes.
  const { activeId: activeSiteId } = useActiveSite();
  const [editing, setEditing] = useState<MinimumPurchase | null>(null);
  const prompt = usePrompt();

  const { mutateAsync: deleteMinimumPurchase } = useDeleteMinimumPurchase({
    onSuccess: () => toast.success(t('DELETE_SUCCESS')),
    onError: (error) => toast.error(t('DELETE_ERROR', { msg: error.message })),
  });

  const onDelete = useCallback(
    async (record: MinimumPurchase) => {
      const confirmed = await prompt({
        title: t('DELETE_TITLE'),
        description: t('DELETE_DESCRIPTION', {
          amount: formatAmount(record.amount, record.currency_code, locale),
        }),
        variant: 'danger',
        confirmText: t('DELETE_CONFIRM'),
        cancelText: t('CANCEL'),
      });
      if (!confirmed) return;
      await deleteMinimumPurchase(record.id);
    },
    [prompt, deleteMinimumPurchase, t, locale]
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('amount', {
        header: t('COLUMN_AMOUNT'),
        cell: ({ row }) => (
          <span className="flex items-center gap-2 font-medium">
            {formatAmount(row.original.amount, row.original.currency_code, locale)}
            {activeSiteId && row.original.site_id === null ? (
              <Badge size="2xsmall" color="grey">
                {t('BADGE_GLOBAL')}
              </Badge>
            ) : null}
          </span>
        ),
      }),
      columnHelper.accessor('currency_code', {
        header: t('COLUMN_CURRENCY'),
        cell: ({ getValue }) => (
          <span className="uppercase text-ui-fg-subtle">{getValue()}</span>
        ),
      }),
      columnHelper.accessor('starts_at', {
        header: t('COLUMN_STARTS_AT'),
        cell: ({ getValue }) => formatDateTime(getValue(), locale),
      }),
      columnHelper.accessor('ends_at', {
        header: t('COLUMN_ENDS_AT'),
        cell: ({ getValue }) => formatDateTime(getValue(), locale),
      }),
      columnHelper.accessor('note', {
        header: t('COLUMN_NOTE'),
        cell: ({ getValue }) => (
          <span className="block max-w-xs truncate">{getValue() || '-'}</span>
        ),
      }),
      columnHelper.accessor('created_at', {
        header: t('COLUMN_CREATED_AT'),
        cell: ({ getValue }) => (
          <span className="text-ui-fg-subtle">{formatDateTime(getValue(), locale)}</span>
        ),
      }),
      columnHelper.action({
        actions: [
          [
            {
              label: t('ACTION_EDIT'),
              icon: <PencilSquare />,
              onClick: ({ row }) => setEditing(row.original),
            },
          ],
          [
            {
              label: t('ACTION_DELETE'),
              icon: <Trash />,
              onClick: ({ row }) => void onDelete(row.original),
            },
          ],
        ],
      }),
    ],
    // `activeSiteId` va en las deps: la etiqueta "Global" depende de la tienda elegida.
    [t, locale, activeSiteId, onDelete]
  );

  const table = useDataTable({
    columns,
    data: minimumPurchases,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  });

  return (
    <>
      <Container className="p-0">
        {/*
          El botón de ayuda va en el header de la PANTALLA y no dentro de cada pestaña:
          lo que el drawer de `store-config` explica es justamente por qué las siete no
          tienen el mismo alcance. Repetirlo siete veces diría lo mismo siete veces; una
          sola vez, arriba, es donde se hace la pregunta.
        */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-x-2">
            <Heading level="h1">{t('TITLE')}</Heading>
            <ExtensionVersion extension="store-config" />
          </div>
          <HelpDrawer slug="store-config" />
        </div>
        <Tabs defaultValue="branches">
          <div className="border-b border-ui-border-base px-6 pb-4 pt-1">
            <Tabs.List>
              <Tabs.Trigger value="commerce">{t('TAB_COMMERCE')}</Tabs.Trigger>
              <Tabs.Trigger value="branches">{t('TAB_BRANCHES')}</Tabs.Trigger>
              <Tabs.Trigger value="storefront">{t('TAB_STOREFRONT')}</Tabs.Trigger>
              <Tabs.Trigger value="legal">{t('TAB_LEGAL')}</Tabs.Trigger>
              <Tabs.Trigger value="ai">{t('TAB_AI')}</Tabs.Trigger>
              <Tabs.Trigger value="fiscal">{t('TAB_FISCAL')}</Tabs.Trigger>
              <Tabs.Trigger value="min-purchase">{t('TAB_MIN_PURCHASE')}</Tabs.Trigger>
              <Tabs.Trigger value="access">{t('TAB_ACCESS')}</Tabs.Trigger>
            </Tabs.List>
          </div>

          {/*
            La barra de tienda va DENTRO de cada pestaña, no arriba de las siete.
            Antes había una sola, con `screen="store-config"`, y su badge decía
            "Filtra por tienda" también en Comercio (que escribe el Store global de
            Medusa), en Acceso (que listaba las tres tiendas) y en Fiscal (que pegaba
            sin el header de tienda). Una barra que promete por siete pantallas sólo
            puede decir la verdad si las siete están en el mismo estado.

            El `screen` va LITERAL en cada una y no interpolado (`store-config.${tab}`)
            porque el registro se cruza con el filesystem por regex
            (`lib/site-scope.test.ts:51`): una plantilla no matchea y las siete
            entradas pasarían por muertas.
          */}
          <Tabs.Content value="commerce">
            <SiteScopeBar screen="store-config.commerce" />
            <div className="flex flex-col gap-4 px-6 py-4">
              <CommerceCard />
              {/*
                Comercio es de instancia y su badge lo dice. Esta card es lo que evita
                que ese badge se lea como "no te incumbe": muestra contra qué región,
                moneda y canales opera la tienda elegida, que es justo lo que el botón
                de arriba le puede cambiar.
              */}
              <CommerceContextCard />
            </div>
          </Tabs.Content>

          <Tabs.Content value="branches">
            <SiteScopeBar screen="store-config.branches" />
            <div className="flex flex-col gap-4 px-6 py-4">
              <BranchSettingsCard />
              {/*
                El nombre del canal presencial va acá y no en Comercio porque el
                escáner de códigos —lo único que usa ese canal— se prende justo
                arriba, en BranchSettingsCard. `hideEnvOnly` porque el bloque "sólo
                por entorno" del namespace se muestra una sola vez, en la pestaña IA,
                que es donde están las doce variables que explica.
                `hideSiteContext` porque esta pestaña YA tiene su `SiteScopeBar`
                arriba: si esta card mostrara TAMBIÉN su propia franja de tienda
                habría dos controles para elegir tienda en la misma pantalla, que es
                peor que ninguno.
              */}
              <ExtensionSettingsCard
                namespace="extension:store-config"
                groups={['Venta presencial']}
                title="Venta presencial"
                /* `description` de UNA oración. Que guardar acá no renombre un canal
                   existente —y que editarlo DESPUÉS de correr el script cree uno nuevo—
                   está en la sección "El nombre del canal presencial no renombra nada"
                   del drawer de arriba. */
                description="Con qué nombre busca o crea el canal el script de setup presencial."
                hideEnvOnly
                hideSiteContext
              />
            </div>
          </Tabs.Content>

          <Tabs.Content value="storefront">
            <SiteScopeBar screen="store-config.storefront" />
            <div className="px-6 py-4">
              <StorefrontSettingsCard />
            </div>
          </Tabs.Content>

          {/*
            Legales: los textos de las tres páginas `/legal/*` del storefront, que
            hasta acá estaban hardcodeados en el código del sitio. `scoped` de verdad —
            la ruta lee y escribe con la tienda activa, y publicar los términos y
            condiciones de otra tienda no es un error cosmético.
          */}
          <Tabs.Content value="legal">
            <SiteScopeBar screen="store-config.legal" />
            <div className="px-6 py-4">
              <LegalPagesCard />
            </div>
          </Tabs.Content>

          <Tabs.Content value="ai">
            <SiteScopeBar screen="store-config.ai" />
            <div className="flex flex-col gap-4 px-6 py-4">
              <AiConfigCard />
              {/*
                Card SIN CAMPOS a propósito (`only={[]}` no matchea ninguna key). Lo
                único que aporta es el bloque "Sólo por entorno", que es del
                NAMESPACE y no de un grupo: son las doce variables de IA que este
                módulo lee y que NO se editan acá — seis las edita otra extensión y
                seis son la semilla de los defaults de la card de arriba. Sin esto,
                el operador que busca "por qué no puedo cambiar el modelo" no tiene
                dónde enterarse de que sí puede, en otra pantalla.
              */}
              {/* `hideSiteContext`: misma razón que en la pestaña "Sucursales" — esta
                  pestaña ya tiene su propia `SiteScopeBar` arriba. */}
              <ExtensionSettingsCard
                namespace="extension:store-config"
                only={[]}
                title="Variables de entorno de IA"
                description="De dónde sale cada valor por defecto de la card de arriba, y en qué pantalla se edita el que manda."
                hideSiteContext
              />
            </div>
          </Tabs.Content>

          <Tabs.Content value="fiscal">
            <SiteScopeBar screen="store-config.fiscal" />
            <div className="px-6 py-4">
              <FiscalDocsTab />
            </div>
          </Tabs.Content>

          <Tabs.Content value="min-purchase">
            <SiteScopeBar screen="store-config.min-purchase" />
            <div className="flex flex-col gap-4 px-6 py-4">
              {/* Current minimum card */}
              <div className="flex flex-col gap-1 rounded-lg border border-ui-border-base p-6">
                <Text size="small" className="text-ui-fg-subtle">
                  {t('MIN_PURCHASE_CURRENT_LABEL')}
                </Text>
                {current ? (
                  <>
                    <Heading level="h2">
                      {formatAmount(current.amount, current.currency_code, locale)}
                    </Heading>
                    <Text size="small" className="text-ui-fg-subtle">
                      {current.ends_at
                        ? t('MIN_PURCHASE_CURRENT_UNTIL', {
                            date: formatDateTime(current.ends_at, locale),
                          })
                        : t('MIN_PURCHASE_CURRENT_OPEN_ENDED')}
                    </Text>
                  </>
                ) : (
                  <Heading level="h2">{t('MIN_PURCHASE_NONE')}</Heading>
                )}
                <Text size="xsmall" className="text-ui-fg-muted mt-2">
                  {t('MIN_PURCHASE_AUDIT_HINT')}
                </Text>
              </div>

              {/* History table: one row per validity window, editable from the row menu */}
              <div className="rounded-lg border border-ui-border-base">
                <DataTable instance={table}>
                  <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
                    <Heading level="h2">{t('MIN_PURCHASE_TITLE')}</Heading>
                    <MinimumPurchaseCreateDrawer />
                  </DataTable.Toolbar>
                  {count > 0 || isPending ? (
                    <>
                      <DataTable.Table />
                      <DataTable.Pagination />
                    </>
                  ) : (
                    <div className="flex items-center justify-center border-t p-6 text-center">
                      <Text className="text-ui-fg-subtle">{t('EMPTY_STATE')}</Text>
                    </div>
                  )}
                </DataTable>
              </div>
              <MinimumPurchaseEditDrawer record={editing} onClose={() => setEditing(null)} />
            </div>
          </Tabs.Content>

          <Tabs.Content value="access">
            <SiteScopeBar screen="store-config.access" />
            <div className="px-6 py-4">
              <SiteGateCard />
            </div>
          </Tabs.Content>
        </Tabs>
      </Container>
      <Toaster />
    </>
  );
};

const PreferencesIcon = () => <CogSixTooth style={{ color: '#E0B917' }} />;

export const config = defineRouteConfig({
  label: 'Preferencias',
  icon: PreferencesIcon,
  rank: 80,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Preferencias',
};

export default StoreConfig;
