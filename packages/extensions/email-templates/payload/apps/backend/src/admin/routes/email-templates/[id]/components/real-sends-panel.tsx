import { Badge, Button, StatusBadge, Text, Tooltip } from '@medusajs/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useEmailTemplateSends,
  type SendVariable,
  type SendVariableState,
  type TemplateSend,
} from '../../../../hooks/api/email-templates';

/**
 * "Últimos envíos reales" — los valores con los que el mail salió DE VERDAD.
 *
 * Convive con el editor de `sample_data` y por eso su copy es tan insistente: los dos
 * bloques mostraban una lista de variables y uno era de mentira. El operador no tenía
 * cómo saber cuál miraba, y esa ambigüedad costó semanas de investigación cuando
 * `sales_channel_name` salió vacía en producción mientras la vista previa la mostraba
 * perfecta (porque la vista previa la rellena con el branding de la tienda; el emisor
 * real no).
 *
 * Regla de diseño de esta sección: NUNCA una tabla en blanco. Sin envíos va un texto
 * que explica qué falta que pase; con envíos escondidos por tienda va el contador.
 * Una tabla vacía se lee como "todo bien" y es la mentira por omisión que esta
 * pantalla vino a cerrar.
 */

/** Formato local corto: la fecha se compara contra "el mail que mandé hace un rato". */
function formatSentAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * El valor tal cual, sin embellecer.
 *
 * Los objetos y arrays van como JSON indentado a propósito: `order_items` es donde
 * viven los bugs de cantidad y precio, y un "[object Object]" o un resumen amable
 * los taparía. Esta pantalla es un microscopio, no un resumen.
 */
function renderValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2) ?? String(value);
}

const STATE_COLOR: Record<SendVariableState, 'green' | 'orange' | 'red'> = {
  ok: 'green',
  empty: 'orange',
  // `missing` es ROJO y `empty` naranja: no son grados de lo mismo. `empty` es un
  // dato que la fuente no tenía; `missing` es un emisor que nunca la pobló, o sea
  // código que hay que arreglar. Son dos reclamos a dos personas distintas.
  missing: 'red',
};

function VariableRow({ variable }: { variable: SendVariable }) {
  const { t } = useTranslation('emailTemplates');
  const problem = variable.state !== 'ok';

  const stateHelp =
    variable.state === 'missing'
      ? t('SENDS_STATE_MISSING_HELP')
      : variable.state === 'empty'
        ? t('SENDS_STATE_EMPTY_HELP')
        : undefined;

  return (
    <div
      className={`flex flex-col gap-1 border-b border-ui-border-base px-3 py-2 last:border-b-0 ${
        problem ? 'bg-ui-bg-subtle' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Text size="xsmall" weight="plus" className="font-mono text-ui-fg-base">
          {variable.name}
        </Text>
        {/* El badge de estado va SIEMPRE, también en `ok`: si sólo apareciera cuando
            hay problema, una lista sin badges sería indistinguible de una lista que
            no se pudo analizar. */}
        {stateHelp ? (
          <Tooltip content={stateHelp}>
            <StatusBadge color={STATE_COLOR[variable.state]}>
              {t(`SENDS_STATE_${variable.state.toUpperCase()}`)}
            </StatusBadge>
          </Tooltip>
        ) : (
          <StatusBadge color={STATE_COLOR[variable.state]}>
            {t('SENDS_STATE_OK')}
          </StatusBadge>
        )}
        {variable.masked && (
          <Tooltip content={t('SENDS_MASKED')}>
            <Badge size="2xsmall">🔒</Badge>
          </Tooltip>
        )}
      </div>

      {variable.description && (
        <Text size="xsmall" className="text-ui-fg-muted">
          {variable.description}
        </Text>
      )}

      {variable.state === 'missing' ? (
        <Text size="xsmall" className="font-mono text-ui-fg-error">
          {t('SENDS_VALUE_MISSING')}
        </Text>
      ) : (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-ui-bg-base px-2 py-1 font-mono text-ui-fg-subtle text-xs">
          {renderValue(variable.value)}
        </pre>
      )}
    </div>
  );
}

function SendListItem({
  send,
  selected,
  onSelect,
}: {
  send: TemplateSend;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('emailTemplates');
  // `empty` + `missing`: las dos salen vacías en el mail. El operador tiene que ver
  // desde la LISTA que este envío tuvo un problema, sin abrirlo uno por uno — que es
  // lo que hoy hace a mano contra la base.
  const problems = send.counts.empty + send.counts.missing;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-col items-start gap-0.5 border-b border-ui-border-base px-3 py-2 text-left last:border-b-0 hover:bg-ui-bg-base-hover ${
        selected ? 'bg-ui-bg-highlight' : ''
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <Text size="xsmall" weight="plus">
          {formatSentAt(send.created_at)}
        </Text>
        <StatusBadge color={send.status === 'success' ? 'green' : 'red'}>
          {send.status}
        </StatusBadge>
      </div>
      <Text size="xsmall" className="w-full truncate text-ui-fg-subtle">
        {send.to}
      </Text>
      {problems > 0 ? (
        <Text size="xsmall" className="text-ui-fg-error">
          {problems === 1
            ? t('SENDS_PROBLEMS_ONE')
            : t('SENDS_PROBLEMS_OTHER', { count: problems })}
        </Text>
      ) : (
        <Text size="xsmall" className="text-ui-fg-muted">
          {t('SENDS_NO_PROBLEMS')}
        </Text>
      )}
    </button>
  );
}

export function RealSendsPanel({ templateId }: { templateId: string }) {
  const { t } = useTranslation('emailTemplates');
  const { data, isLoading, isError, error, refetch, isFetching } =
    useEmailTemplateSends(templateId);

  const sends = data?.sends ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // El más reciente preseleccionado: es el que el operador vino a mirar. Sin esto la
  // sección abre en "elegí un envío", un click de fricción sobre la respuesta obvia.
  useEffect(() => {
    if (sends.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !sends.some((s) => s.id === selectedId)) {
      setSelectedId(sends[0]!.id);
    }
  }, [sends, selectedId]);

  const selected = useMemo(
    () => sends.find((s) => s.id === selectedId) ?? null,
    [sends, selectedId],
  );

  return (
    <div className="flex flex-col gap-2 border-t border-ui-border-base pt-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <Text size="small" weight="plus">
            {t('SENDS_TITLE')}
          </Text>
          <Text size="xsmall" className="text-ui-fg-muted">
            {t('SENDS_HELP')}
          </Text>
        </div>
        <Button
          variant="secondary"
          size="small"
          onClick={() => void refetch()}
          isLoading={isFetching}
        >
          {t('SENDS_REFRESH')}
        </Button>
      </div>

      {/* El contraste explícito entre las dos fuentes. Es UNA línea y es la que
          contesta la pregunta del usuario ("no sé cuáles son las de verdad"), así que
          va siempre visible y no colapsada en "Avanzado". */}
      <Text size="xsmall" className="rounded-lg bg-ui-bg-subtle p-2 text-ui-fg-subtle">
        {t('SENDS_VS_SAMPLE')}
      </Text>

      {isLoading && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {t('SENDS_LOADING')}
        </Text>
      )}

      {isError && (
        <Text size="xsmall" className="text-ui-fg-error">
          {t('SENDS_ERROR', { msg: (error as Error)?.message ?? '' })}
        </Text>
      )}

      {/* Estado vacío EXPLICADO, no una tabla en blanco. */}
      {!isLoading && !isError && sends.length === 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-ui-border-base border-dashed p-3">
          <Text size="xsmall" className="text-ui-fg-subtle">
            {t('SENDS_EMPTY')}
          </Text>
          <Text size="xsmall" className="text-ui-fg-muted">
            {t('SENDS_EMPTY_HINT')}
          </Text>
        </div>
      )}

      {/* Lo que se OCULTÓ por tienda se dice. Ocultar en silencio dejaría una lista
          corta que se lee como "hubo pocos envíos". */}
      {!isLoading && (data?.unattributed ?? 0) > 0 && (
        <Text size="xsmall" className="text-ui-fg-warning">
          {t('SENDS_UNATTRIBUTED', { count: data!.unattributed })}
        </Text>
      )}

      {sends.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="max-h-56 overflow-y-auto rounded-lg border border-ui-border-base">
            {sends.map((send) => (
              <SendListItem
                key={send.id}
                send={send}
                selected={send.id === selectedId}
                onSelect={() => setSelectedId(send.id)}
              />
            ))}
          </div>

          {selected ? (
            <div className="flex flex-col gap-2">
              <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
                {t('SENDS_COLUMN_VARIABLE')} · {t('SENDS_COLUMN_VALUE')}
              </Text>
              <div className="rounded-lg border border-ui-border-base">
                {selected.variables.map((variable) => (
                  <VariableRow key={variable.name} variable={variable} />
                ))}
              </div>

              {selected.undeclared.length > 0 && (
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
                    {t('SENDS_UNDECLARED_TITLE', {
                      count: selected.undeclared.length,
                    })}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('SENDS_UNDECLARED_HELP')}
                  </Text>
                  <div className="rounded-lg border border-ui-border-base border-dashed">
                    {selected.undeclared.map((variable) => (
                      <VariableRow key={variable.name} variable={variable} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Text size="xsmall" className="text-ui-fg-subtle">
              {t('SENDS_SELECT_HINT')}
            </Text>
          )}
        </div>
      )}
    </div>
  );
}

export default RealSendsPanel;
