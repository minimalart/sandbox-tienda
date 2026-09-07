import { Badge, Button, StatusBadge, Text, Tooltip } from '@medusajs/ui';
import { CheckCircleSolid, XCircleSolid } from '@medusajs/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ga4ConfigTestResponse, useGa4Config, useTestGa4Config } from '../../../hooks/api/ga4-mappings';

const GA4_ADMIN_URL = 'https://analytics.google.com/analytics/web/';

/** Un ítem del checklist de activación: verde si está OK, rojo si falta. */
const ChecklistItem = ({ ok, label }: { ok: boolean; label: string }) => (
  <div className="flex items-center gap-2">
    {ok ? (
      <CheckCircleSolid className="text-ui-tag-green-icon" />
    ) : (
      <XCircleSolid className="text-ui-tag-red-icon" />
    )}
    <Text size="small" className="text-ui-fg-subtle">
      {label}
    </Text>
  </div>
);

/**
 * Bloque con el estado del envío server-side (activo/inactivo), el checklist
 * de activación, el link a Google Analytics y el botón de "evento de prueba".
 * Los campos editables (Measurement ID, API Secret, GTM ID, Debug) viven en el
 * formulario de la página — esto solo refleja lo que ya está guardado.
 * Se monta dentro del mismo Container de la página de configuración (no tiene
 * Container propio para evitar cajas anidadas).
 */
export const Ga4ConfigPanel = () => {
  const { t } = useTranslation('ga4Events');
  const { data } = useGa4Config();
  const [result, setResult] = useState<Ga4ConfigTestResponse | null>(null);
  const { mutate: runTest, isPending: isTesting } = useTestGa4Config({
    onSuccess: setResult,
    onError: (error) =>
      setResult({ valid: false, configured: true, validation_messages: [], message: error.message }),
  });

  if (!data) return null;

  const dispatchActive = Boolean(data.measurement_id && data.api_secret_set);

  return (
    <>
      <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
        {data.debug && (
          <Badge size="2xsmall" color="orange">
            {t('CONFIG_DEBUG')}
          </Badge>
        )}
        <StatusBadge color={dispatchActive ? 'green' : 'grey'}>
          {dispatchActive ? t('CONFIG_DISPATCH_ACTIVE') : t('CONFIG_DISPATCH_INACTIVE')}
        </StatusBadge>
      </div>
      {!dispatchActive && (
        <div className="flex flex-col gap-2 border-t px-6 py-3">
          <Text size="small" weight="plus" className="text-ui-fg-subtle">
            {t('CONFIG_CHECKLIST_TITLE')}
          </Text>
          <ChecklistItem ok={Boolean(data.measurement_id)} label={t('CONFIG_MEASUREMENT_ID')} />
          <ChecklistItem ok={data.api_secret_set} label={t('CONFIG_CHECKLIST_API_SECRET')} />
          <Text size="small" className="text-ui-fg-muted">
            {t('CONFIG_DISPATCH_HINT')}
          </Text>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t px-6 py-3">
        <a
          href={GA4_ADMIN_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="txt-compact-small text-ui-fg-interactive"
        >
          {t('CONFIG_OPEN_GA4')} ↗
        </a>
        {dispatchActive ? (
          <Button
            variant="secondary"
            size="small"
            isLoading={isTesting}
            onClick={() => runTest()}
          >
            {t('CONFIG_TEST_BUTTON')}
          </Button>
        ) : (
          // Botón deshabilitado: envuelto en span para que el Tooltip reciba el
          // hover (un <button disabled> no dispara eventos de puntero).
          <Tooltip content={t('CONFIG_TEST_DISABLED_TOOLTIP')}>
            <span tabIndex={0}>
              <Button variant="secondary" size="small" disabled>
                {t('CONFIG_TEST_BUTTON')}
              </Button>
            </span>
          </Tooltip>
        )}
      </div>
      <div className="border-t px-6 py-3">
        <Text size="small" className="text-ui-fg-muted">
          {t('CONFIG_TEST_HELP')} <code className="txt-compact-small">ga4_connection_test</code>
        </Text>
      </div>
      {result && <TestResult result={result} />}
    </>
  );
};

/** Resultado del evento de prueba: válido (verde) o con los mensajes de GA4. */
const TestResult = ({ result }: { result: Ga4ConfigTestResponse }) => {
  const { t } = useTranslation('ga4Events');

  if (result.valid) {
    return (
      <div className="flex items-center gap-2 border-t bg-ui-bg-subtle px-6 py-3">
        <CheckCircleSolid className="text-ui-tag-green-icon" />
        <Text size="small" className="text-ui-fg-subtle">
          {t('CONFIG_TEST_SUCCESS', { event: result.event_name ?? 'ga4_connection_test' })}
        </Text>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t bg-ui-bg-subtle px-6 py-3">
      <div className="flex items-center gap-2">
        <XCircleSolid className="text-ui-tag-red-icon" />
        <Text size="small" weight="plus" className="text-ui-fg-subtle">
          {result.configured ? t('CONFIG_TEST_INVALID') : t('CONFIG_TEST_NOT_CONFIGURED')}
        </Text>
      </div>
      {result.message && (
        <Text size="small" className="text-ui-fg-muted">
          {result.message}
        </Text>
      )}
      {result.validation_messages.map((m, i) => (
        <Text key={i} size="small" className="text-ui-fg-muted">
          {m.fieldPath ? `${m.fieldPath}: ` : ''}
          {m.description}
        </Text>
      ))}
    </div>
  );
};
