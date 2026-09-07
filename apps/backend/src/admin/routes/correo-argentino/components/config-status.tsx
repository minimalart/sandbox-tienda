/**
 * Estado de la configuración de Correo Argentino. SOLO LECTURA + una acción.
 *
 * ⚠️ Esta página NO es el equivalente de `andreani/configuracion`, que administra
 * CAJAS. Correo no tiene cajas: su API toma **solo el primer elemento** de
 * `parcels[]` y descarta el resto, así que cada pedido viaja como un único bulto
 * consolidado y no hay nada que un operador pueda configurar ahí.
 *
 * Lo que muestra, y con qué endpoint:
 *
 *  - **Registro del provider** (`GET /admin/fulfillment-providers`): el módulo se
 *    registra únicamente cuando `CORREO_ARGENTINO_API_KEY` está presente
 *    (`medusa-config.ts` lo gatea así), o sea que la aparición del provider ES la
 *    señal de que la API-Key está configurada. No es una inferencia floja: es la
 *    condición literal del registro.
 *  - **Opciones de envío sembradas** (`GET /admin/shipping-options`): si los
 *    seeds corrieron, `correo-domicilio` y `correo-sucursal` están acá con su
 *    `service_type` / `delivery_type`.
 *  - **Estado de configuración de las claves de Correo**
 *    (`GET /admin/correo-argentino/health`): nombres, orígenes y booleanos, nunca
 *    valores. Distingue "tiene valor" de "tiene valor y el módulo lo acepta" —que
 *    no es lo mismo y es el caso que más cuesta diagnosticar— y, desde que la
 *    configuración vive en la base, dice DE QUÉ CAPA sale cada una. Mientras el
 *    reporte miraba `process.env`, una tienda con todo cargado en `site_setting`
 *    veía las 42 filas en rojo y el operador salía a "arreglar" lo que andaba.
 *  - **Prueba de conexión**
 *    (`GET /admin/correo-argentino/health?probe=true`): pega contra las DOS APIs.
 *
 * Dos cosas deliberadas en la prueba de conexión:
 *
 *  1. **La dispara el botón, no el montaje del componente.** Cada corrida hace un
 *     `GET /auth` contra paqar y un `POST /token` + `POST /rates` contra MiCorreo;
 *     ejecutarla en cada render sería pegarle al gateway del carrier (y gastar
 *     cuota del acuerdo) porque alguien navegó a una pantalla.
 *  2. **Reporta las dos APIs por separado**, porque Correo necesita las dos y
 *     fallan distinto: sin paqar no se puede operar; sin MiCorreo no se puede
 *     cotizar y cada envío se le muestra al comprador como "Gratuito".
 */

import {
  Alert,
  Badge,
  Button,
  Container,
  Heading,
  StatusBadge,
  Table,
  Text,
} from '@medusajs/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCorreoConnectionProbe,
  useCorreoEnvStatus,
  useCorreoProviderStatus,
  useCorreoShippingOptions,
  type CorreoProbeOutcome,
  type CorreoSettingStatus,
  type CorreoShippingOption,
} from '../../../hooks/api/correo-argentino';
import {
  correoEnvVarColor,
  correoEnvVarState,
  correoHealthColor,
  correoHealthLabelKey,
} from '../../../lib/correo';
import { registerCorreoArgentinoTranslations } from '../../../translations/correo-argentino';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { HelpDrawer } from '../../../components/common/help-drawer';

function dataField(option: CorreoShippingOption, key: string): string | null {
  const value = option.data?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/** Orden de lectura de los grupos: primero lo que rompe más. */
const ENV_GROUPS = [
  'paqar',
  'micorreo',
  'origen',
  'remitente',
  'producto',
  'fallback',
  'operacion',
  'seeds',
] as const;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? '');
}

export function ConfigStatus() {
  const { t, i18n } = useTranslation('correoArgentino');
  registerCorreoArgentinoTranslations(i18n);

  const { data: provider, isLoading: providerLoading } = useCorreoProviderStatus();
  const { data: options = [], isLoading: optionsLoading } =
    useCorreoShippingOptions();
  const {
    data: health,
    isLoading: envLoading,
    error: envError,
  } = useCorreoEnvStatus();
  const probe = useCorreoConnectionProbe();

  const env = health?.config;
  const probeData = probe.data;

  // Las dos APIs pueden apuntar a ambientes distintos desde que MiCorreo tiene su
  // propio override de host. El `?.` no es redundancia: un backend anterior a
  // `targets` devuelve el JSON sin ese campo y acá no hay validación de respuesta.
  const micorreoTarget = env?.targets?.micorreo ?? env?.target;
  const targetsDiffer = !!env && !!micorreoTarget && micorreoTarget !== env.target;

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-2 px-6 py-4">
        <div className="flex items-center justify-between gap-x-2">
          <div className="flex items-center gap-x-2">
            <Heading>{t('CONFIG_TITLE')}</Heading>
            <ExtensionVersion extension="correo-argentino" />
          </div>
          {/* El drawer se cuelga de ESTE header y no de una `ExtensionSettingsCard`
              de la página: la ayuda es de la extensión entera, y las cards de abajo
              son cuatro — atarla a una la haría parecer ayuda de ese grupo. Este es
              además el único header de la pantalla. */}
          <HelpDrawer slug="correo-argentino" />
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {t('CONFIG_SUBTITLE')}
        </Text>
      </div>

      {/* Acá vivía el `Alert` con `CONFIG_NO_BOXES_NOTE`: "Correo NO maneja cajas,
          su API toma sólo el primer elemento de parcels[]". Se mudó al drawer
          (sección "Correo no maneja cajas"). Era un cartel `info` permanente, no
          condicional: aparecía en cada visita aunque nadie estuviera buscando el
          CRUD de cajas, y un `Alert` que nunca se apaga deja de leerse como aviso. */}

      {/* ── Registro del provider ── */}
      <div className="flex flex-col gap-3 px-6 py-4">
        <Heading level="h3">{t('CONFIG_PROVIDER_TITLE')}</Heading>

        {providerLoading ? (
          <Text size="small" className="text-ui-fg-muted">
            {t('CONFIG_LOADING')}
          </Text>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge color={provider?.registered ? 'green' : 'red'}>
                {provider?.registered
                  ? t('CONFIG_PROVIDER_REGISTERED')
                  : t('CONFIG_PROVIDER_MISSING')}
              </StatusBadge>
              {provider?.registered && (
                <>
                  <Badge size="2xsmall" color="grey">
                    {provider.provider_id}
                  </Badge>
                  <Badge
                    size="2xsmall"
                    color={provider.is_enabled ? 'green' : 'orange'}
                  >
                    {provider.is_enabled
                      ? t('CONFIG_PROVIDER_ENABLED')
                      : t('CONFIG_PROVIDER_DISABLED')}
                  </Badge>
                </>
              )}
            </div>
            {/* Sólo se muestra la rama de FALLA. `CONFIG_PROVIDER_HINT` explicaba
                por qué aparece registrado (el módulo se registra únicamente con la
                API key seteada): es contexto del camino feliz, cierto siempre, y se
                mudó al drawer. `CONFIG_PROVIDER_MISSING_HINT` se queda porque es el
                otro caso: dice qué revisar cuando el provider NO está. */}
            {!provider?.registered && (
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('CONFIG_PROVIDER_MISSING_HINT')}
              </Text>
            )}
          </>
        )}
      </div>

      {/* ── Opciones de envío sembradas ── */}
      <div className="flex flex-col gap-3 px-6 py-4">
        <Heading level="h3">{t('CONFIG_OPTIONS_TITLE')}</Heading>

        {optionsLoading ? (
          <Text size="small" className="text-ui-fg-muted">
            {t('CONFIG_LOADING')}
          </Text>
        ) : options.length === 0 ? (
          <Alert variant="warning">{t('CONFIG_OPTIONS_EMPTY')}</Alert>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t('CONFIG_OPTIONS_COL_NAME')}</Table.HeaderCell>
                <Table.HeaderCell>{t('CONFIG_OPTIONS_COL_ID')}</Table.HeaderCell>
                <Table.HeaderCell>
                  {t('CONFIG_OPTIONS_COL_SERVICE')}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {t('CONFIG_OPTIONS_COL_DELIVERY')}
                </Table.HeaderCell>
                <Table.HeaderCell>{t('CONFIG_OPTIONS_COL_PRICE')}</Table.HeaderCell>
                <Table.HeaderCell>{t('CONFIG_OPTIONS_COL_ZONE')}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {options.map((option) => {
                const optionId = dataField(option, 'id');
                const serviceType = dataField(option, 'service_type');
                const deliveryType = dataField(option, 'delivery_type');

                return (
                  <Table.Row key={option.id}>
                    <Table.Cell>
                      <Text size="small" weight="plus">
                        {option.name}
                      </Text>
                    </Table.Cell>
                    {/* Un campo faltante se marca en rojo en vez de mostrarse
                        vacío: un seed a medias es exactamente lo que esta
                        pantalla tiene que delatar. */}
                    {[optionId, serviceType, deliveryType].map((value, index) => (
                      <Table.Cell key={index}>
                        {value ? (
                          <Text size="small" className="font-mono">
                            {value}
                          </Text>
                        ) : (
                          <Badge size="2xsmall" color="red">
                            {t('CONFIG_OPTIONS_MISSING_FIELD')}
                          </Badge>
                        )}
                      </Table.Cell>
                    ))}
                    <Table.Cell>
                      <Text size="small">{option.price_type}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">{option.service_zone?.name ?? '—'}</Text>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        )}
      </div>

      {/* ── Presencia de env vars: booleanos, nunca valores ── */}
      <div className="flex flex-col gap-3 px-6 py-4">
        <Heading level="h3">{t('CONFIG_ENV_TITLE')}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t('CONFIG_ENV_NOTE')}
        </Text>

        {envLoading && (
          <Text size="small" className="text-ui-fg-muted">
            {t('CONFIG_LOADING')}
          </Text>
        )}

        {envError && (
          <Alert variant="error">
            {t('CONFIG_ENV_ERROR', { message: errorMessage(envError) })}
          </Alert>
        )}

        {/* Va PRIMERO y en rojo: con el blob ilegible el módulo tira al despachar,
            así que todo lo que se lea más abajo está incompleto a sabiendas. */}
        {health?.credentials_unreadable && (
          <Alert variant="error">{t('CONFIG_ENV_CREDENTIALS_UNREADABLE')}</Alert>
        )}

        {env && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('CONFIG_ENV_TARGET')}
              </Text>
              {/* Producción en naranja: saber que se está apuntando al ambiente
                  que factura envíos reales es lo primero que hay que ver acá. */}
              <Badge
                size="2xsmall"
                color={env.target === 'prod' ? 'orange' : 'grey'}
              >
                {targetsDiffer && `${t('CONFIG_ENV_TARGET_API_PAQAR')}: `}
                {t(`CONFIG_ENV_TARGET_${env.target.toUpperCase()}`)}
              </Badge>
              {/* Segundo badge SOLO cuando las dos APIs apuntan distinto: es una
                  configuración deliberada (`CORREO_ARGENTINO_MICORREO_HOSTNAME`)
                  y "cotizo en prod pero opero en test" tiene que ser visible. */}
              {targetsDiffer && micorreoTarget && (
                <Badge
                  size="2xsmall"
                  color={micorreoTarget === 'prod' ? 'orange' : 'grey'}
                >
                  {`${t('CONFIG_ENV_TARGET_API_MICORREO')}: `}
                  {t(`CONFIG_ENV_TARGET_${micorreoTarget.toUpperCase()}`)}
                </Badge>
              )}
            </div>

            {env.missing_required.length > 0 && (
              <Alert variant="error">
                {t('CONFIG_ENV_MISSING_REQUIRED', {
                  names: env.missing_required.join(', '),
                })}
              </Alert>
            )}
            {env.missing_quoting.length > 0 && (
              <Alert variant="error">
                {t('CONFIG_ENV_MISSING_QUOTING', {
                  names: env.missing_quoting.join(', '),
                })}
              </Alert>
            )}
            {env.missing_operating.length > 0 && (
              <Alert variant="warning">
                {t('CONFIG_ENV_MISSING_OPERATING', {
                  names: env.missing_operating.join(', '),
                })}
              </Alert>
            )}
            {env.missing_required.length === 0 &&
              env.missing_quoting.length === 0 &&
              env.missing_operating.length === 0 && (
                <Alert variant="success">{t('CONFIG_ENV_ALL_OK')}</Alert>
              )}

            {/* Una variable cargada que el módulo descarta es el caso más
                traicionero: se aclara una vez y arriba de la lista. */}
            {env.settings.some((entry) => correoEnvVarState(entry) === 'invalida') && (
              <Alert variant="error">{t('CONFIG_ENV_INVALID_NOTE')}</Alert>
            )}

            {ENV_GROUPS.map((group) => {
              const groupVars = env.settings.filter((entry) => entry.group === group);
              if (groupVars.length === 0) return null;

              return (
                <div className="flex flex-col gap-2" key={group}>
                  <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
                    {t(`CONFIG_ENV_GROUP_${group.toUpperCase()}`)}
                  </Text>
                  <div className="grid grid-cols-1 gap-x-4 gap-y-1 md:grid-cols-2">
                    {groupVars.map((entry) => (
                      <EnvVarRow entry={entry} key={entry.name} />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── Prueba de conexión: opt-in, la dispara el botón ── */}
      <div className="flex flex-col gap-3 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Heading level="h3">{t('CONFIG_TEST_TITLE')}</Heading>
          <Button
            disabled={probe.isFetching}
            isLoading={probe.isFetching}
            onClick={() => {
              void probe.refetch();
            }}
            size="small"
            variant="secondary"
          >
            {probe.isFetching ? t('CONFIG_TEST_RUNNING') : t('CONFIG_TEST_BUTTON')}
          </Button>
        </div>
        {/* Acá vivía `CONFIG_TEST_NOTE`: contra qué endpoints pega la prueba y que
            corre sólo al apretar el botón. Se mudó al drawer, que lo dice en el paso
            de "Puesta en marcha" donde importa —cuando alguien está por probar la
            conexión por primera vez—, en vez de repetirlo debajo del botón para
            siempre. */}

        {/* Un error acá es de la LLAMADA a nuestra propia ruta (sesión vencida,
            backend abajo): la ruta de health nunca devuelve 5xx porque una sonda
            falló — esos casos vienen adentro del 200. */}
        {probe.isError && (
          <Alert variant="error">
            {t('CONFIG_TEST_ERROR', { message: errorMessage(probe.error) })}
          </Alert>
        )}

        {!probeData && !probe.isFetching && !probe.isError && (
          <Text size="small" className="text-ui-fg-muted">
            {t('CONFIG_TEST_NEVER_RUN')}
          </Text>
        )}

        {probeData && (
          <>
            <ProbeResult label={t('CONFIG_TEST_PAQAR')} outcome={probeData.paqar} />
            <ProbeResult
              label={t('CONFIG_TEST_MICORREO')}
              outcome={probeData.micorreo}
            >
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('CONFIG_TEST_PROBE_DETAIL', {
                  code: probeData.micorreo.probe_destination_postal_code,
                })}
              </Text>
              {!probeData.micorreo.probe_used_configured_origin &&
                probeData.micorreo.status !== 'sin_credenciales' && (
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_TEST_ORIGIN_FALLBACK')}
                  </Text>
                )}
            </ProbeResult>

            {/* NO es un warning tibio: mientras la cuenta no esté activada, cada
                envío de Correo se cotiza en $0 y el flete lo paga el comercio. */}
            {probeData.micorreo.status === 'cuenta_no_activada' && (
              <Alert variant="error">
                {t('CONFIG_TEST_ACCOUNT_NOT_ACTIVATED')}
              </Alert>
            )}

            <Text size="xsmall" className="text-ui-fg-muted">
              {t('CONFIG_TEST_AT', {
                date: new Date(probeData.checked_at).toLocaleString(),
              })}
            </Text>
          </>
        )}
      </div>
    </Container>
  );
}

/**
 * Una clave: nombre + estado + ORIGEN. El VALOR nunca llega al browser.
 *
 * Los dos badges contestan preguntas distintas y por eso van los dos. El estado
 * dice si el módulo puede operar; el origen dice DÓNDE tocar para cambiarlo, que
 * es lo único accionable cuando la queja es "en la tienda B anda distinto". Un
 * `heredado (global)` en verde y un `de esta tienda` en verde se ven igual en un
 * semáforo y significan cosas opuestas para el que va a editar.
 */
function EnvVarRow({ entry }: { entry: CorreoSettingStatus }) {
  const { t } = useTranslation('correoArgentino');
  const state = correoEnvVarState(entry);

  return (
    <div className="flex items-center justify-between gap-2">
      <Text size="xsmall" className="font-mono text-ui-fg-subtle">
        {entry.name}
      </Text>
      <div className="flex shrink-0 items-center gap-1">
        {/* El origen sólo aporta cuando HAY valor: con la clave vacía, "sin
            configurar" ya lo dice todo y un segundo badge sería ruido. */}
        {entry.configured && (
          <Badge color="grey" size="2xsmall">
            {t(`CONFIG_ENV_SOURCE_${entry.source.toUpperCase()}`)}
          </Badge>
        )}
        <Badge color={correoEnvVarColor(entry)} size="2xsmall">
          {t(`CONFIG_ENV_STATE_${state.toUpperCase()}`)}
        </Badge>
      </div>
    </div>
  );
}

/** Resultado de la sonda de UNA de las dos APIs. */
function ProbeResult({
  label,
  outcome,
  children,
}: {
  label: string;
  outcome: CorreoProbeOutcome;
  children?: ReactNode;
}) {
  const { t } = useTranslation('correoArgentino');

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge color={correoHealthColor(outcome.status)}>
          {t(correoHealthLabelKey(outcome.status))}
        </StatusBadge>
        <Text size="small" weight="plus">
          {label}
        </Text>
        {outcome.http_status !== null && (
          <Badge size="2xsmall" color="grey">
            {t('CONFIG_TEST_HTTP', { status: outcome.http_status })}
          </Badge>
        )}
      </div>
      {outcome.message && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {outcome.message}
        </Text>
      )}
      {outcome.retryable && (
        <Text size="xsmall" className="text-ui-fg-muted">
          {t('CONFIG_TEST_RETRYABLE')}
        </Text>
      )}
      {children}
    </div>
  );
}
