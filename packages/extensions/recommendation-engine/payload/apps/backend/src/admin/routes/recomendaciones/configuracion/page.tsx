import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Toaster,
  toast,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { SettingLabel } from '../../../components/common/setting-label';
import {
  usePreviewRecommendation,
  useRecommendationPlacements,
  useRecommendationStrategies,
  useRecommendationsConfig,
  useSeedRecommendations,
  useUpdateRecommendationPlacement,
  useUpdateRecommendationStrategy,
  useUpdateRecommendationsConfig,
  type ProductCard as ProductCardData,
  type RecommendationPlacement,
  type RecommendationStrategy,
} from '../../../hooks/api/recommendations';
import { ProductCard } from '../relaciones/components/product-card';
import { ProductPicker } from '../relaciones/components/product-picker';

export const config = defineRouteConfig({ label: 'Configuración' });
export const handle = { breadcrumb: () => 'Configuración' };

/** Placement que no arranca de un producto sino del monto que falta para el envío gratis. */
const BRIDGE_PLACEMENT = 'free-shipping-bridge';

/** Monto faltante por defecto del preview del bridge. Sólo afecta a la previsualización. */
const DEFAULT_BRIDGE_TARGET = 5000;

/**
 * El producto de ejemplo sobrevive al refresh: elegirlo de nuevo en cada recarga para
 * comparar seis placements es la clase de fricción que hace que nadie use el preview.
 * Se guarda la card entera (no el id) para no tener que rehidratarla al montar.
 */
const SAMPLE_STORAGE_KEY = 'recommendations:preview-sample-product';

/**
 * Las doce variables de operación, repartidas en dos cards por los mismos `group`
 * que ya declaran los descriptores.
 *
 * Van al FINAL de la página y no arriba, al revés que en Andreani: ahí la página ES
 * la configuración, acá lo de arriba es el producto —qué ve el comprador— y esto es
 * la sala de máquinas. El orden de la página es el orden en que se usa.
 *
 * `hideEnvOnly` en la segunda: ese bloque —los cuatro cron y los cuatro topes duros—
 * es del NAMESPACE, no del grupo, así que sin esto saldría repetido.
 */
const SETTINGS_SECTIONS: { title: string; groups: string[]; description: string }[] = [
  {
    title: 'Operación del motor',
    groups: ['Estado', 'Servicio'],
    // UNA oración. La trampa de los dos interruptores homónimos —éstos apagan el
    // motor en TODAS las tiendas, el "Motor activo" de arriba sólo en ésta— tiene
    // sección propia en el drawer ("Los dos interruptores que se llaman igual"), y
    // el botón está en el header de esta misma página.
    description: 'Interruptores de la instalación, el rate limit público y el secreto de firma.',
  },
  {
    title: 'Recálculo y retención',
    groups: ['Recálculo', 'Retención y métricas'],
    // UNA oración. Que el motor corre en el mismo procesador que la tienda —y que
    // subir estos topes se lo saca al tiempo de respuesta del storefront— está en
    // el drawer, sección "El motor corre en el mismo procesador que la tienda".
    description: 'Presupuesto de cada recálculo y alcance de la purga nocturna.',
  },
];

const readStoredSample = (): ProductCardData | null => {
  try {
    const raw = window.localStorage.getItem(SAMPLE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProductCardData) : null;
  } catch {
    // Storage bloqueado o JSON corrupto: se arranca sin producto de ejemplo.
    return null;
  }
};

const KIND_LABELS: Record<string, string> = {
  manual: 'Relaciones manuales',
  similar: 'Similares por atributos',
  frequently_bought_together: 'Comprados juntos',
  trending: 'En tendencia',
  popular: 'Más vendidos',
};

/**
 * Campo numérico que muestra el default y el tope efectivo.
 *
 * Los límites los aplica igual el backend (`mergeRecommendationsConfig`); acá se
 * muestran para que el merchant sepa por qué su 9999 se guardó como 60, en lugar de
 * pensar que el guardado falló.
 *
 * DOS canales, y la diferencia no es de largo sino de naturaleza. `hint` es un DATO
 * —el tope que devuelve `hard_caps`— y se queda en línea: es un valor renderizado, y
 * esconderlo detrás de un ícono deja al campo sin decir contra qué se recorta.
 * `help` es la aclaración de qué significa el número, que es cierta siempre y no
 * depende del estado: ésa va al tooltip del label, que es el mecanismo de
 * `components/common/setting-label.tsx`.
 */
function NumberField({
  label,
  value,
  onChange,
  hint,
  help,
  min = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Dato en línea: el tope efectivo que aplica el backend. */
  hint?: string;
  /** Aclaración fija del campo. Va al tooltip, no debajo del input. */
  help?: string;
  min?: number;
  step?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <SettingLabel label={label} hint={help} size="small" weight="plus" />
      <Input
        type="number"
        min={min}
        step={step}
        value={String(value)}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
      {hint ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {hint}
        </Text>
      ) : null}
    </div>
  );
}

function StrategyCard({ strategy }: { strategy: RecommendationStrategy }) {
  const update = useUpdateRecommendationStrategy();
  const config = strategy.effective_config;
  const isFbt = strategy.kind === 'frequently_bought_together';
  const isTrending = strategy.kind === 'trending';
  const isCalculated = strategy.kind !== 'manual';

  const save = (patch: Record<string, unknown>) =>
    update.mutate(
      { id: strategy.id, ...patch },
      {
        onSuccess: () => toast.success(`"${strategy.name}" actualizada`),
        onError: (error: Error) => toast.error(error.message),
      },
    );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Text weight="plus">{strategy.name}</Text>
            <Badge size="2xsmall" color={strategy.enabled ? 'green' : 'grey'}>
              {strategy.enabled ? 'Activa' : 'Inactiva'}
            </Badge>
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            {KIND_LABELS[strategy.kind] ?? strategy.kind} · <code>{strategy.key}</code>
          </Text>
        </div>
        <Switch
          checked={strategy.enabled}
          onCheckedChange={(checked) => save({ enabled: checked })}
          disabled={update.isPending}
        />
      </div>

      {strategy.fallback_chain?.length ? (
        <Text size="small" className="text-ui-fg-subtle">
          Si no alcanza, sigue con: {strategy.fallback_chain.join(' → ')}
        </Text>
      ) : (
        <Text size="small" className="text-ui-fg-subtle">
          Sin fallback (es el último recurso de la cadena).
        </Text>
      )}

      {isCalculated ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumberField
            label="Ventana histórica (días)"
            value={config.lookback_days}
            onChange={(lookback_days) => save({ config: { lookback_days } })}
            min={1}
          />
          {isTrending ? (
            <>
              <NumberField
                label="Ventana de tendencia (horas)"
                value={config.window_hours}
                onChange={(window_hours) => save({ config: { window_hours } })}
                min={1}
              />
              <NumberField
                label="Unidades mínimas"
                value={config.min_units}
                onChange={(min_units) => save({ config: { min_units } })}
                min={1}
              />
            </>
          ) : null}
          {isFbt ? (
            <>
              <NumberField
                label="Órdenes mínimas analizadas"
                value={config.min_orders_analyzed}
                onChange={(min_orders_analyzed) => save({ config: { min_orders_analyzed } })}
                min={1}
                help="Debajo de este número no se publica ninguna relación automática."
              />
              <NumberField
                label="Co-ocurrencias mínimas"
                value={config.min_co_occurrences}
                onChange={(min_co_occurrences) => save({ config: { min_co_occurrences } })}
                min={1}
              />
              <NumberField
                label="Confianza mínima"
                value={config.min_confidence}
                onChange={(min_confidence) => save({ config: { min_confidence } })}
                min={0}
                step={0.05}
                help="0 a 1. El lift nunca se usa como criterio único."
              />
              <NumberField
                label="Tamaño máximo de canasta"
                value={config.max_basket_size}
                onChange={(max_basket_size) => save({ config: { max_basket_size } })}
                min={2}
                help="Las órdenes con más líneas se ignoran en el cálculo de co-compra."
              />
            </>
          ) : null}
          <NumberField
            label="Relaciones máximas por producto"
            value={config.max_relations_per_source}
            onChange={(max_relations_per_source) => save({ config: { max_relations_per_source } })}
            min={1}
          />
        </div>
      ) : (
        <Text size="small" className="text-ui-fg-subtle">
          No se recalcula: las relaciones las cargás a mano en{' '}
          <Link to="/recomendaciones/relaciones" className="text-ui-fg-interactive hover:underline">
            Recomendaciones → Relaciones
          </Link>
          .
        </Text>
      )}
    </div>
  );
}

function PlacementCard({
  placement,
  strategies,
  sample,
}: {
  placement: RecommendationPlacement;
  strategies: RecommendationStrategy[];
  sample: ProductCardData | null;
}) {
  const update = useUpdateRecommendationPlacement();
  const preview = usePreviewRecommendation();
  const isBridge = placement.key === BRIDGE_PLACEMENT;
  const [bridgeTarget, setBridgeTarget] = useState(DEFAULT_BRIDGE_TARGET);

  // El bridge no parte de un producto: los candidatos salen del set global de populares
  // filtrado por la banda de precio del faltante.
  const needsSample = !isBridge;
  const canPreview = !needsSample || Boolean(sample);

  const runPreview = () =>
    preview.mutate({
      placement: placement.key,
      ...(sample && needsSample ? { product_id: sample.id } : {}),
      ...(isBridge ? { target_price: bridgeTarget } : {}),
      // Un placement acotado a un canal sólo responde en ese canal: hay que mandarlo o
      // el preview de ese placement volvería siempre vacío.
      ...(placement.sales_channel_id ? { sales_channel_id: placement.sales_channel_id } : {}),
    });

  const result = preview.data;
  const strategyName = (key: string | null) =>
    (key ? strategies.find((strategy) => strategy.key === key)?.name : null) ?? key ?? '—';

  const save = (patch: Record<string, unknown>) =>
    update.mutate(
      { id: placement.id, ...patch },
      {
        onSuccess: () => toast.success(`"${placement.name}" actualizado`),
        onError: (error: Error) => toast.error(error.message),
      },
    );

  const filters = placement.filters ?? {};

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Text weight="plus">{placement.name}</Text>
          <Text size="small" className="text-ui-fg-subtle">
            <code>{placement.key}</code>
          </Text>
        </div>
        <Switch
          checked={placement.enabled}
          onCheckedChange={(checked) => save({ enabled: checked })}
          disabled={update.isPending}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label size="small" weight="plus">
            Estrategia
          </Label>
          <Select value={placement.strategy_key} onValueChange={(strategy_key) => save({ strategy_key })}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {strategies.map((strategy) => (
                <Select.Item key={strategy.key} value={strategy.key}>
                  {strategy.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <NumberField
          label="Productos a mostrar"
          value={placement.result_limit}
          onChange={(result_limit) => save({ result_limit })}
          min={1}
        />
        <NumberField
          label="Candidatos a leer"
          value={placement.candidate_limit}
          onChange={(candidate_limit) => save({ candidate_limit })}
          min={1}
          help="Se leen muchos más de los que se muestran porque el stock y el canal se filtran al servir."
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <Switch
            checked={Boolean(filters.same_category)}
            onCheckedChange={(checked) =>
              save({ filters: { ...filters, same_category: checked, different_category: false } })
            }
          />
          <Text size="small">Sólo misma categoría</Text>
        </label>
        <label className="flex items-center gap-2">
          <Switch
            checked={Boolean(filters.different_category)}
            onCheckedChange={(checked) =>
              save({ filters: { ...filters, different_category: checked, same_category: false } })
            }
          />
          <Text size="small">Sólo otra categoría</Text>
        </label>
        <label className="flex items-center gap-2">
          <Switch
            checked={Boolean(filters.same_brand)}
            onCheckedChange={(checked) => save({ filters: { ...filters, same_brand: checked } })}
          />
          <Text size="small">Sólo misma marca</Text>
        </label>
      </div>

      {/* --- Previsualización -------------------------------------------------
        Se dispara con botón y no al montar: cada preview es una resolución completa
        del motor contra la base y hay seis placements en pantalla.
      */}
      <div className="flex flex-col gap-3 border-t border-ui-border-base pt-3">
        <div className="flex flex-wrap items-center gap-3">
          {isBridge ? (
            <div className="flex items-center gap-2">
              <Text size="small" className="text-ui-fg-subtle">
                Falta para envío gratis
              </Text>
              <Input
                type="number"
                className="w-28"
                min={0}
                value={String(bridgeTarget)}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) setBridgeTarget(next);
                }}
              />
            </div>
          ) : null}
          <Button
            size="small"
            variant="secondary"
            disabled={!canPreview}
            isLoading={preview.isPending}
            onClick={runPreview}
          >
            {result ? 'Actualizar vista previa' : 'Ver qué productos muestra'}
          </Button>
          {!canPreview ? (
            <Text size="small" className="text-ui-fg-subtle">
              Elegí un producto de ejemplo arriba para previsualizar este placement.
            </Text>
          ) : null}
        </div>

        {preview.isError ? (
          <Text size="small" className="text-ui-fg-error">
            {(preview.error as Error).message}
          </Text>
        ) : null}

        {result ? (
          <>
            {result.products.length ? (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {result.products.map((card) => (
                  <ProductCard key={card.id} card={card} />
                ))}
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-subtle">
                {!placement.enabled
                  ? 'El placement está apagado: la tienda no muestra nada acá.'
                  : result.error
                    ? `No se pudo resolver: ${result.error}`
                    : result.debug && result.debug.candidates_loaded === 0
                      ? 'Ninguna estrategia de la cadena tiene datos todavía: cargá relaciones manuales o esperá el primer cálculo.'
                      : 'Había candidatos pero los filtros (stock, canal, categoría, marca) los descartaron a todos.'}
              </Text>
            )}

            {/*
              La cadena que devuelve el motor es el comportamiento REAL: si un eslabón
              está apagado o sin datos, acá no aparece.
            */}
            <Text size="small" className="text-ui-fg-subtle">
              {result.count} de {result.limit} · resuelto por{' '}
              {strategyName(result.resolved_strategy_key)}
              {result.fallback_used
                ? ` (fallback — la cadena fue ${result.fallback_chain
                    .map((key) => strategyName(key))
                    .join(' → ')})`
                : ''}
            </Text>
          </>
        ) : (
          <Text size="small" className="text-ui-fg-subtle">
            Cadena efectiva:{' '}
            {placement.effective_chain.length
              ? placement.effective_chain.map((key) => strategyName(key)).join(' → ')
              : '—'}
          </Text>
        )}
      </div>
    </div>
  );
}

const RecommendationsConfigPage = () => {
  const { data, isPending } = useRecommendationsConfig();
  const strategies = useRecommendationStrategies();
  const placements = useRecommendationPlacements();
  const updateConfig = useUpdateRecommendationsConfig();
  const seed = useSeedRecommendations();

  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  const [sample, setSample] = useState<ProductCardData | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // El producto de ejemplo se lee del storage en un efecto y no en el `useState`
  // inicial: leer `window` durante el primer render rompería el server render del
  // bundle del admin.
  useEffect(() => {
    setSample(readStoredSample());
  }, []);

  const chooseSample = (product: ProductCardData | null) => {
    setSample(product);
    setPickerOpen(false);
    try {
      if (product) window.localStorage.setItem(SAMPLE_STORAGE_KEY, JSON.stringify(product));
      else window.localStorage.removeItem(SAMPLE_STORAGE_KEY);
    } catch {
      // Storage bloqueado: el ejemplo vale para esta sesión y listo.
    }
  };

  // El borrador se rehidrata cuando llega la config: sin esto, editar un campo y
  // recibir un refetch de react-query pisaría lo tipeado.
  useEffect(() => {
    if (!data?.config) return;
    setDraft({
      default_result_limit: data.config.default_result_limit,
      default_candidate_limit: data.config.default_candidate_limit,
      max_chain_length: data.config.max_chain_length,
      min_results: data.config.min_results,
    });
  }, [data?.config]);

  const config = data?.config;
  const caps = data?.hard_caps ?? {};

  const isEmpty =
    !isPending && (strategies.data?.count ?? 0) === 0 && (placements.data?.count ?? 0) === 0;

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heading level="h1">Recomendaciones</Heading>
            <ExtensionVersion extension="recommendation-engine" />
            {/* El slug sigue al DESCRIPTOR (`recommendation-engine`), no al directorio
                de la ruta (`recomendaciones`): la clave de `help/index.ts` es la misma
                que la del namespace de ajustes y la del markdown generado. */}
            <HelpDrawer slug="recommendation-engine" />
          </div>
          {config ? (
            <div className="flex items-center gap-2">
              <Text size="small">{config.enabled ? 'Motor activo' : 'Motor apagado'}</Text>
              <Switch
                checked={config.enabled}
                onCheckedChange={(enabled) =>
                  updateConfig.mutate(
                    { enabled },
                    {
                      onSuccess: () =>
                        toast.success(enabled ? 'Motor activado' : 'Motor apagado'),
                      onError: (error: Error) => toast.error(error.message),
                    },
                  )
                }
              />
            </div>
          ) : null}
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-ui-border-base border-dashed p-6">
            <Text>
              Todavía no hay estrategias ni placements. Sembrá la configuración por defecto para
              empezar: incluye relaciones manuales, similares, comprados juntos, tendencia y más
              vendidos, con cadenas de fallback que terminan siempre en más vendidos.
            </Text>
            <Button
              size="small"
              isLoading={seed.isPending}
              onClick={() =>
                seed.mutate(undefined, {
                  onSuccess: (result) =>
                    toast.success(
                      `Sembrado: ${result.strategies_created} estrategias y ${result.placements_created} placements`,
                    ),
                  onError: (error: Error) => toast.error(error.message),
                })
              }
            >
              Sembrar configuración por defecto
            </Button>
          </div>
        ) : null}

        {config && draft ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <NumberField
              label="Productos por defecto"
              value={draft.default_result_limit ?? config.default_result_limit}
              onChange={(value) => setDraft({ ...draft, default_result_limit: value })}
              min={1}
              hint={`Máximo ${caps.result_limit ?? '—'}`}
            />
            <NumberField
              label="Candidatos por defecto"
              value={draft.default_candidate_limit ?? config.default_candidate_limit}
              onChange={(value) => setDraft({ ...draft, default_candidate_limit: value })}
              min={1}
              hint={`Máximo ${caps.candidate_limit ?? '—'}`}
            />
            <NumberField
              label="Largo máximo de cadena"
              value={draft.max_chain_length ?? config.max_chain_length}
              onChange={(value) => setDraft({ ...draft, max_chain_length: value })}
              min={1}
              hint={`Máximo ${caps.max_chain_length ?? '—'}`}
            />
            <NumberField
              label="Resultados mínimos por eslabón"
              value={draft.min_results ?? config.min_results}
              onChange={(value) => setDraft({ ...draft, min_results: value })}
              min={1}
              help="Debajo de esto se prueba el fallback siguiente."
            />
            <div className="sm:col-span-4">
              <Button
                size="small"
                isLoading={updateConfig.isPending}
                onClick={() =>
                  updateConfig.mutate(draft, {
                    onSuccess: () => toast.success('Configuración guardada'),
                    onError: (error: Error) => toast.error(error.message),
                  })
                }
              >
                Guardar límites
              </Button>
            </div>
          </div>
        ) : null}
      </Container>

      <Container className="flex flex-col gap-4">
        <Heading level="h2">Estrategias</Heading>
        {strategies.isPending ? (
          <Text className="text-ui-fg-subtle">Cargando…</Text>
        ) : (
          (strategies.data?.strategies ?? []).map((strategy) => (
            <StrategyCard key={strategy.id} strategy={strategy} />
          ))
        )}
      </Container>

      <Container className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Heading level="h2">Placements</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Cada placement es un lugar de la tienda. Elegí un producto de ejemplo y
            previsualizá cada uno para ver los productos que se muestran hoy.
          </Text>
        </div>

        {/* Selector de producto de ejemplo, compartido por todos los placements. */}
        <div className="flex flex-col gap-2 rounded-lg border border-ui-border-base border-dashed p-3">
          <div className="flex items-center justify-between gap-3">
            <Text size="small" weight="plus">
              Producto de ejemplo
            </Text>
            {sample ? (
              <div className="flex items-center gap-2">
                <Button size="small" variant="transparent" onClick={() => setPickerOpen(!pickerOpen)}>
                  Cambiar
                </Button>
                <Button size="small" variant="transparent" onClick={() => chooseSample(null)}>
                  Quitar
                </Button>
              </div>
            ) : null}
          </div>

          {sample ? <ProductCard card={sample} /> : null}

          {!sample || pickerOpen ? (
            <ProductPicker
              label={sample ? 'Elegí otro producto' : 'Buscá el producto con el que querés probar'}
              excludeIds={sample ? [sample.id] : []}
              onSelect={chooseSample}
            />
          ) : null}
        </div>

        {placements.isPending ? (
          <Text className="text-ui-fg-subtle">Cargando…</Text>
        ) : (
          (placements.data?.placements ?? []).map((placement) => (
            <PlacementCard
              key={placement.id}
              placement={placement}
              strategies={strategies.data?.strategies ?? []}
              sample={sample}
            />
          ))
        )}
      </Container>

      {/*
        `hideSiteContext` mismo criterio que `hideEnvOnly`: la barra de contexto
        de tienda es del namespace, no de cada card — sólo la primera la muestra.
      */}
      {SETTINGS_SECTIONS.map((section, index) => (
        <ExtensionSettingsCard
          key={section.title}
          namespace="extension:recommendation-engine"
          title={section.title}
          groups={section.groups}
          description={section.description}
          hideEnvOnly={index > 0}
          hideSiteContext={index > 0}
        />
      ))}

      <Toaster />
    </div>
  );
};

export default RecommendationsConfigPage;
