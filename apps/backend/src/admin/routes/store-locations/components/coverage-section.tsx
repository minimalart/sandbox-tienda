import {
  Button,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  StatusBadge,
  Switch,
  Text,
  toast,
} from '@medusajs/ui';
import { PencilSquare, Plus, Trash } from '@medusajs/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../../lib/client';
import {
  AdminCoverageResponse,
  BranchCoverageItem,
  PolygonPoint,
} from '../../../hooks/api';
import { PolygonPicker } from './polygon-picker';
import {
  countVertices,
  extractGeoJsonAreas,
  ringToPolygonPoints,
  type DiscardReason,
  type GeoJsonArea,
  type GeoJsonAreasResult,
} from '../../../components/geo/geojson-areas';
import {
  DEFAULT_SIMPLIFY_TOLERANCE_M,
  MIN_RING_POSITIONS,
  reductionPercent,
  simplifyAreas,
  SIMPLIFY_TOLERANCES_M,
} from '../../../components/geo/simplify-ring';

let draftSeq = 0;
const nextKey = () => `cov-${draftSeq++}`;

/** A coverage zone draft held in the parent form (create + edit). */
export interface CoverageDraft {
  key: string;
  id?: string;
  name: string;
  priority: string;
  active: boolean;
  polygon: PolygonPoint[];
  _deleted?: boolean;
  _dirty?: boolean;
}

export const emptyCoverageDraft = (): CoverageDraft => ({
  key: nextKey(),
  name: '',
  priority: '0',
  active: true,
  polygon: [],
});

export const fromCoverageItem = (item: BranchCoverageItem): CoverageDraft => ({
  key: nextKey(),
  id: item.id,
  name: item.name,
  priority: String(item.priority ?? 0),
  active: item.active,
  polygon: Array.isArray(item.polygon) ? item.polygon : [],
});

interface CoverageSectionProps {
  value: CoverageDraft[];
  onChange: (value: CoverageDraft[]) => void;
  center?: { lat: number; lng: number } | null;
  /**
   * OPCIONAL. Id de la sucursal, cuando ya existe. Con id, la importación en
   * lote crea las zonas contra la API en el momento (con progreso y reporte);
   * sin id —sucursal nueva, todavía sin guardar— las deja como borradores y el
   * formulario las crea al guardar. Las dos ramas se DICEN en la UI: la
   * diferencia importa si el operador cierra el drawer sin guardar.
   */
  storeLocationId?: string | null;
}

/** El motivo de descarte, traducido. Las claves viven en `translations/store-locations`. */
const DISCARD_REASON_KEY: Record<DiscardReason, string> = {
  too_few_points: 'COVERAGE_IMPORT_REASON_FEW_POINTS',
  non_finite: 'COVERAGE_IMPORT_REASON_NON_FINITE',
  out_of_range: 'COVERAGE_IMPORT_REASON_OUT_OF_RANGE',
  malformed_ring: 'COVERAGE_IMPORT_REASON_MALFORMED',
};

/** Estado de una importación en curso o terminada (lo que ve el operador). */
interface ImportProgress {
  total: number;
  done: number;
  created: number;
  /** Las que fallaron, con el error tal cual vino de la API. */
  failed: { label: string; message: string }[];
  running: boolean;
  /** true = quedaron como borradores porque la sucursal todavía no existe. */
  queued: boolean;
}

const CoverageRow = ({
  item,
  onEdit,
  onDelete,
  disabled = false,
}: {
  item: CoverageDraft;
  onEdit: () => void;
  onDelete: () => void;
  /** Mientras corre una importación en lote: editar o borrar acá pisaría la lista. */
  disabled?: boolean;
}) => {
  const { t } = useTranslation('storeLocations');
  const points = Array.isArray(item.polygon) ? item.polygon.length : 0;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-ui-border-base p-2">
      <div className="flex flex-col">
        <span className="text-ui-fg-base text-sm font-medium">{item.name}</span>
        <span className="text-ui-fg-subtle text-xs">
          {t('COVERAGE_POINTS', { n: points })} · {t('COVERAGE_PRIORITY_LABEL')} {item.priority}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <StatusBadge color={item.active ? 'green' : 'grey'}>
          {item.active ? t('COVERAGE_ACTIVE_LABEL') : t('STATUS_HIDDEN')}
        </StatusBadge>
        <IconButton
          size="small"
          variant="transparent"
          type="button"
          onClick={onEdit}
          disabled={disabled}
        >
          <PencilSquare />
        </IconButton>
        <IconButton
          size="small"
          variant="transparent"
          type="button"
          onClick={onDelete}
          disabled={disabled}
        >
          <Trash />
        </IconButton>
      </div>
    </div>
  );
};

/** Inline create/edit editor that mutates a single draft in memory. */
const CoverageEditor = ({
  initial,
  center,
  onDone,
  onCancel,
  onMultiArea,
}: {
  initial: CoverageDraft;
  center?: { lat: number; lng: number } | null;
  onDone: (draft: CoverageDraft) => void;
  onCancel: () => void;
  /** El archivo subido trae más de un área: lo maneja la sección, no este editor. */
  onMultiArea: (result: GeoJsonAreasResult, fileName: string) => void;
}) => {
  const { t } = useTranslation('storeLocations');
  const [form, setForm] = useState<CoverageDraft>(initial);

  /**
   * Este editor edita UN polígono. Si el archivo trae varias áreas, se lo pasa
   * a la sección para que ofrezca crearlas todas — nunca se queda con la #0 y
   * tira el resto, que es el bug que dejó a las cuatro sucursales de Bariloche
   * con el polígono de Junín de los Andes.
   */
  const handleAreas = (result: GeoJsonAreasResult, fileName: string) => {
    if (result.areas.length > 1) {
      onMultiArea(result, fileName);
      return;
    }
    const only = result.areas[0];
    if (!only) {
      toast.error(t('COVERAGE_GEOJSON_ERROR'));
      return;
    }
    if (result.ignoredHoles > 0) {
      toast.warning(t('COVERAGE_GEOJSON_HOLES', { n: result.ignoredHoles }));
    }
    if (result.discarded.length) {
      toast.warning(t('COVERAGE_GEOJSON_DISCARDED', { n: result.discarded.length }));
    }
    setForm((p) => ({
      ...p,
      polygon: ringToPolygonPoints(only.ring),
      name: p.name.trim() || (only.name ?? ''),
    }));
  };

  const handleDone = () => {
    if (!form.name.trim()) {
      toast.error(t('COVERAGE_NAME_LABEL'));
      return;
    }
    if (form.polygon.length < 3) {
      toast.error(t('COVERAGE_NO_POLYGON'));
      return;
    }
    onDone({ ...form, name: form.name.trim() });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="cov-name">{t('COVERAGE_NAME_LABEL')}</Label>
        <Input
          id="cov-name"
          placeholder={t('COVERAGE_NAME_PLACEHOLDER')}
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cov-priority">{t('COVERAGE_PRIORITY_LABEL')}</Label>
          <Input
            id="cov-priority"
            type="number"
            value={form.priority}
            onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
          />
        </div>
        <div className="flex items-end justify-between gap-2">
          <Label htmlFor="cov-active">{t('COVERAGE_ACTIVE_LABEL')}</Label>
          <Switch
            id="cov-active"
            checked={form.active}
            onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))}
          />
        </div>
      </div>

      <PolygonPicker
        value={form.polygon}
        center={center}
        onChange={(polygon) => setForm((p) => ({ ...p, polygon }))}
        onAreasParsed={handleAreas}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('COVERAGE_CANCEL')}
        </Button>
        <Button type="button" onClick={handleDone}>
          {t('COVERAGE_DONE')}
        </Button>
      </div>
    </div>
  );
};

/**
 * Panel de importación. Cuenta lo que trae el archivo ANTES de tocar nada y
 * obliga a una decisión explícita: crear las N zonas, o quedarse con una sola.
 * "Quedarse con la primera" dejó de ser el default silencioso.
 *
 * Acá también se elige la SIMPLIFICACIÓN. Es el segundo dato del archivo que la
 * importación cambia, y vale la misma regla que los nombres y los agujeros: el
 * antes y el después se muestran siempre, total y por área, antes de apretar el
 * botón. Ver `simplify-ring.ts` para el porqué del número.
 */
const ImportPanel = ({
  result,
  fileName,
  progress,
  onImport,
  onCancel,
}: {
  result: GeoJsonAreasResult;
  fileName: string;
  progress: ImportProgress | null;
  onImport: (areas: GeoJsonArea[], priority: number, active: boolean) => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation('storeLocations');
  const [mode, setMode] = useState<'all' | 'one'>('all');
  const [selected, setSelected] = useState('0');
  const [priority, setPriority] = useState('0');
  const [active, setActive] = useState(true);
  const [tolerance, setTolerance] = useState(String(DEFAULT_SIMPLIFY_TOLERANCE_M));
  const [detailOpen, setDetailOpen] = useState(false);

  /**
   * Se recalcula sólo cuando cambia el archivo o la tolerancia: RDP sobre 16.687
   * vértices no puede correr en cada render del panel.
   */
  const simplified = useMemo(
    () => simplifyAreas(result.areas, Number(tolerance)),
    [result.areas, tolerance],
  );

  const areaLabel = (area: GeoJsonArea, index: number) =>
    area.name ?? t('COVERAGE_IMPORT_AREA_FALLBACK', { n: index + 1 });

  const running = progress?.running ?? false;
  const finished = progress != null && !progress.running;

  const handleImport = () => {
    const parsedPriority = Number.parseInt(priority, 10);
    const safePriority = Number.isFinite(parsedPriority) ? parsedPriority : 0;
    // Se crean las áreas YA simplificadas: lo que se ve en el resumen es
    // exactamente lo que entra a `branch_coverage`.
    if (mode === 'all') {
      onImport(simplified.areas, safePriority, active);
      return;
    }
    const one = simplified.areas[Number(selected)];
    if (one) onImport([one], safePriority, active);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
      <div>
        <Heading level="h3">{t('COVERAGE_IMPORT_TITLE')}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {fileName}
        </Text>
      </div>

      {/* Lo que el archivo trae. El operador se entera ANTES de decidir. */}
      <Text size="small" className="text-ui-fg-base">
        {t('COVERAGE_IMPORT_SUMMARY', {
          n: result.areas.length,
          points: countVertices(result.areas),
        })}
      </Text>

      {result.ignoredHoles > 0 && (
        <Text size="small" className="text-ui-tag-orange-text">
          {t('COVERAGE_IMPORT_HOLES', { n: result.ignoredHoles })}
        </Text>
      )}

      {result.unsupported.length > 0 && (
        <Text size="small" className="text-ui-tag-orange-text">
          {t('COVERAGE_IMPORT_UNSUPPORTED', {
            n: result.unsupported.length,
            types: [...new Set(result.unsupported)].join(', '),
          })}
        </Text>
      )}

      {/* `active` es la única property, además del nombre, que se importa. */}
      {result.activeFromFile > 0 && (
        <Text size="small" className="text-ui-fg-subtle">
          {t('COVERAGE_IMPORT_ACTIVE_FROM_FILE', {
            n: result.activeFromFile,
            total: result.areas.length,
          })}
        </Text>
      )}

      {/* La regla: toda property que el archivo trae y no se importa, se dice. */}
      {result.ignoredProperties.length > 0 && (
        <Text size="small" className="text-ui-tag-orange-text">
          {t('COVERAGE_IMPORT_IGNORED_PROPS', {
            n: result.ignoredProperties.length,
            props: result.ignoredProperties.join(', '),
          })}
        </Text>
      )}

      {/* `priority` merece su propia línea: el archivo lo usa como ORDEN
          (1 = primero) y el modelo como PESO (mayor gana). Copiarlo literal
          invertiría el desempate. */}
      {result.ignoredProperties.includes('priority') && (
        <Text size="small" className="text-ui-tag-orange-text">
          {t('COVERAGE_IMPORT_PRIORITY_NOTE')}
        </Text>
      )}

      {/* Renombrar en silencio es la misma clase de bug que descartar en silencio. */}
      {result.adjustedNames.length > 0 && (
        <Text size="small" className="text-ui-tag-orange-text">
          {t('COVERAGE_IMPORT_ADJUSTED_NAMES', {
            n: result.adjustedNames.reduce((total, a) => total + a.count, 0),
            detail: result.adjustedNames
              .map((a) => `${a.from} → ${a.to}${a.count > 1 ? ` (×${a.count})` : ''}`)
              .join('; '),
          })}
        </Text>
      )}

      {result.discarded.length > 0 && (
        <Text size="small" className="text-ui-tag-red-text">
          {t('COVERAGE_IMPORT_DISCARDED', {
            n: result.discarded.length,
            detail: result.discarded
              .map((d) => `${d.label} (${t(DISCARD_REASON_KEY[d.reason], { detail: d.detail ?? '' })})`)
              .join('; '),
          })}
        </Text>
      )}

      {/* La tolerancia se elige ANTES de importar y queda congelada mientras corre:
          cambiarla a mitad del lote dejaría unas zonas simplificadas y otras no. */}
      {!running && !finished && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="cov-import-simplify">{t('COVERAGE_IMPORT_SIMPLIFY_LABEL')}</Label>
          <Select value={tolerance} onValueChange={setTolerance}>
            <Select.Trigger id="cov-import-simplify">
              <Select.Value />
            </Select.Trigger>
            <Select.Content className="z-[60]">
              {SIMPLIFY_TOLERANCES_M.map((meters) => (
                <Select.Item key={meters} value={String(meters)}>
                  {meters === 0
                    ? t('COVERAGE_IMPORT_SIMPLIFY_NONE')
                    : t('COVERAGE_IMPORT_SIMPLIFY_OPTION', { n: meters })}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          {Number(tolerance) > 0 && (
            <Text size="small" className="text-ui-fg-subtle">
              {t('COVERAGE_IMPORT_SIMPLIFY_HELP', { n: Number(tolerance) })}
            </Text>
          )}
        </div>
      )}

      {/* El antes y el después se muestran SIEMPRE —también con el lote corriendo
          y ya terminado—: lo que entra a la base no es lo que trae el archivo. */}
      <div className="flex flex-col gap-1">
        <Text size="small" className="text-ui-fg-base">
          {simplified.changed
            ? t('COVERAGE_IMPORT_SIMPLIFY_SUMMARY', {
                before: simplified.before,
                after: simplified.after,
                percent: reductionPercent(simplified.before, simplified.after),
              })
            : t('COVERAGE_IMPORT_SIMPLIFY_UNCHANGED', { n: simplified.before })}
        </Text>

        {/* Las que el piso dejó intactas: no es un error, pero es un dato. */}
        {simplified.flooredCount > 0 && (
          <Text size="small" className="text-ui-tag-orange-text">
            {t('COVERAGE_IMPORT_SIMPLIFY_FLOORED', {
              n: simplified.flooredCount,
              min: MIN_RING_POSITIONS,
              detail: simplified.detail
                .filter((row) => row.floored)
                .map((row) => areaLabel(simplified.areas[row.index], row.index))
                .join(', '),
            })}
          </Text>
        )}

        <div>
          <Button
            type="button"
            variant="transparent"
            size="small"
            onClick={() => setDetailOpen((open) => !open)}
          >
            {detailOpen
              ? t('COVERAGE_IMPORT_SIMPLIFY_DETAIL_HIDE')
              : t('COVERAGE_IMPORT_SIMPLIFY_DETAIL_SHOW', { n: simplified.detail.length })}
          </Button>
        </div>

        {detailOpen && (
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border border-ui-border-base bg-ui-bg-base p-2">
            {simplified.detail.map((row) => (
              <div key={row.index} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-ui-fg-subtle truncate">
                  {areaLabel(simplified.areas[row.index], row.index)}
                </span>
                <span
                  className={
                    row.floored
                      ? 'text-ui-tag-orange-text whitespace-nowrap'
                      : 'text-ui-fg-base whitespace-nowrap'
                  }
                >
                  {t('COVERAGE_IMPORT_SIMPLIFY_ROW', { before: row.before, after: row.after })}
                  {row.floored ? ` · ${t('COVERAGE_IMPORT_SIMPLIFY_ROW_FLOORED')}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!running && !finished && (
        <>
          <div className="flex flex-col gap-2">
            <Label>{t('COVERAGE_IMPORT_MODE_LABEL')}</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as 'all' | 'one')}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content className="z-[60]">
                <Select.Item value="all">
                  {t('COVERAGE_IMPORT_MODE_ALL', { n: result.areas.length })}
                </Select.Item>
                <Select.Item value="one">{t('COVERAGE_IMPORT_MODE_ONE')}</Select.Item>
              </Select.Content>
            </Select>
          </div>

          {/* Quedarse con una sola es una decisión visible, no el default. */}
          {mode === 'one' && (
            <div className="flex flex-col gap-2">
              <Label>{t('COVERAGE_IMPORT_PICK_LABEL')}</Label>
              <Select value={selected} onValueChange={setSelected}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content className="z-[60]">
                  {simplified.areas.map((area, index) => (
                    <Select.Item key={index} value={String(index)}>
                      {areaLabel(area, index)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
              <Text size="small" className="text-ui-fg-subtle">
                {t('COVERAGE_IMPORT_PICK_WARN', { n: result.areas.length - 1 })}
              </Text>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cov-import-priority">{t('COVERAGE_PRIORITY_LABEL')}</Label>
              <Input
                id="cov-import-priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </div>
            <div className="flex items-end justify-between gap-2">
              <Label htmlFor="cov-import-active">{t('COVERAGE_ACTIVE_LABEL')}</Label>
              <Switch
                id="cov-import-active"
                checked={active}
                onCheckedChange={setActive}
              />
            </div>
          </div>
        </>
      )}

      {/* Progreso: 21 llamadas secuenciales no pueden dejar la UI muda. */}
      {running && progress && (
        <Text size="small" className="text-ui-fg-subtle">
          {t('COVERAGE_IMPORT_PROGRESS', { done: progress.done, total: progress.total })}
        </Text>
      )}

      {finished && progress && (
        <div className="flex flex-col gap-1">
          <Text size="small" className="text-ui-fg-base">
            {progress.queued
              ? t('COVERAGE_IMPORT_QUEUED', { n: progress.created })
              : t('COVERAGE_IMPORT_RESULT', { ok: progress.created, total: progress.total })}
          </Text>
          {progress.failed.length > 0 && (
            <Text size="small" className="text-ui-tag-red-text">
              {t('COVERAGE_IMPORT_RESULT_FAILED', {
                n: progress.failed.length,
                detail: progress.failed.map((f) => `${f.label}: ${f.message}`).join('; '),
              })}
            </Text>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={running}>
          {finished ? t('COVERAGE_DONE') : t('COVERAGE_CANCEL')}
        </Button>
        {!finished && (
          <Button type="button" onClick={handleImport} isLoading={running} disabled={running}>
            {mode === 'all'
              ? t('COVERAGE_IMPORT_CONFIRM_ALL', { n: result.areas.length })
              : t('COVERAGE_IMPORT_CONFIRM_ONE')}
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * Coverage polygons for a branch (controlled). Manages an in-memory list of
 * drafts; the parent form persists them (create / update / delete) in a single
 * save. Available in both create and edit mode.
 *
 * La importación en lote es la excepción a "todo son borradores": con la
 * sucursal ya creada, las N zonas se crean en el momento contra
 * `POST /admin/store-locations/:id/coverage`, una llamada por área. Es lo único
 * que permite mostrar progreso y decir "se crearon 18 de 21" — un borrador no
 * puede fallar parcialmente. Las zonas creadas se agregan a la lista CON su id
 * y sin `_dirty`, así el guardado del formulario no las vuelve a crear.
 */
export const CoverageSection = ({
  value,
  onChange,
  center,
  storeLocationId,
}: CoverageSectionProps) => {
  const { t } = useTranslation('storeLocations');
  const queryClient = useQueryClient();
  // null = closed; 'new' = creating; otherwise the draft key being edited.
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  // Archivo parseado esperando decisión. null = no hay importación abierta.
  const [importing, setImporting] = useState<{
    result: GeoJsonAreasResult;
    fileName: string;
  } | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const visible = value.filter((c) => !c._deleted);

  const upsertDraft = (draft: CoverageDraft) => {
    const exists = value.some((c) => c.key === draft.key);
    const marked: CoverageDraft = draft.id ? { ...draft, _dirty: true } : draft;
    onChange(exists ? value.map((c) => (c.key === draft.key ? marked : c)) : [...value, marked]);
    setEditing(null);
  };

  const deleteDraft = (key: string) => {
    const target = value.find((c) => c.key === key);
    if (!target) return;
    onChange(
      target.id
        ? value.map((c) => (c.key === key ? { ...c, _deleted: true } : c))
        : value.filter((c) => c.key !== key),
    );
  };

  const editingDraft =
    editing && editing !== 'new' ? value.find((c) => c.key === editing) : undefined;

  /** Abre el panel de importación con lo que el archivo trae, o dice por qué no. */
  const openImport = (result: GeoJsonAreasResult, fileName: string) => {
    if (!result.areas.length) {
      // Nada usable: el motivo se dice entero, no un "error genérico".
      const detail = result.discarded.length
        ? result.discarded
            .map((d) => `${d.label} (${t(DISCARD_REASON_KEY[d.reason], { detail: d.detail ?? '' })})`)
            .join('; ')
        : t(
            result.error === 'not_geojson'
              ? 'COVERAGE_IMPORT_ERROR_NOT_GEOJSON'
              : 'COVERAGE_IMPORT_ERROR_NO_POLYGON',
          );
      toast.error(t('COVERAGE_IMPORT_ERROR', { detail }));
      return;
    }
    setEditing(null);
    setProgress(null);
    setImporting({ result, fileName });
  };

  /** Lee y parsea el archivo del input de la sección. */
  const handleImportFile = async (file: File) => {
    try {
      openImport(extractGeoJsonAreas(JSON.parse(await file.text())), file.name);
    } catch {
      toast.error(t('COVERAGE_GEOJSON_ERROR'));
    }
  };

  /**
   * Crea las áreas elegidas. Con `storeLocationId`, N llamadas SECUENCIALES al
   * endpoint que ya existe (secuenciales a propósito: 21 POST en paralelo
   * contra la misma sucursal no le hacen ningún favor a nadie, y el progreso
   * tiene que ser legible). Sin id, quedan como borradores.
   */
  const runImport = async (areas: GeoJsonArea[], priority: number, defaultActive: boolean) => {
    const named = areas.map((area, index) => ({
      area,
      name: area.name ?? t('COVERAGE_IMPORT_AREA_FALLBACK', { n: index + 1 }),
      // El `active` del archivo gana: es la única property, además del nombre,
      // cuya semántica coincide con la del modelo. El switch es el default para
      // las áreas que no lo declaran.
      active: area.active ?? defaultActive,
    }));

    // Sucursal nueva: no hay id contra el que crear. Van como borradores y se
    // dice, porque si cierra el drawer sin guardar no se creó nada.
    if (!storeLocationId) {
      const drafts = named.map(({ area, name, active }) => ({
        ...emptyCoverageDraft(),
        name,
        priority: String(priority),
        active,
        polygon: ringToPolygonPoints(area.ring),
      }));
      onChange([...value, ...drafts]);
      setProgress({
        total: drafts.length,
        done: drafts.length,
        created: drafts.length,
        failed: [],
        running: false,
        queued: true,
      });
      return;
    }

    setProgress({ total: named.length, done: 0, created: 0, failed: [], running: true, queued: false });

    const created: CoverageDraft[] = [];
    const failed: { label: string; message: string }[] = [];

    for (const { area, name, active } of named) {
      try {
        const res = await sdk.client.fetch<AdminCoverageResponse>(
          `/admin/store-locations/${storeLocationId}/coverage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { name, polygon: ringToPolygonPoints(area.ring), priority, active },
          },
        );
        if (res?.coverage) created.push(fromCoverageItem(res.coverage));
      } catch (e) {
        failed.push({ label: name, message: e instanceof Error ? e.message : 'error' });
      }
      setProgress((p) =>
        p ? { ...p, done: p.done + 1, created: created.length, failed: [...failed] } : p,
      );
    }

    // Las creadas entran con id y SIN `_dirty`: el guardado del formulario las
    // saltea (mirá el loop de `saveSections`) y no se duplican.
    if (created.length) onChange([...value, ...created]);
    queryClient.invalidateQueries({
      queryKey: ['store-location', storeLocationId, 'coverage'],
    });

    setProgress({
      total: named.length,
      done: named.length,
      created: created.length,
      failed,
      running: false,
      queued: false,
    });

    // La falla parcial es aceptable, pero queda DICHA en las dos vías: el panel
    // y el toast.
    if (failed.length) {
      toast.error(
        `${t('COVERAGE_IMPORT_RESULT', { ok: created.length, total: named.length })} ${t(
          'COVERAGE_IMPORT_RESULT_FAILED',
          { n: failed.length, detail: failed.map((f) => `${f.label}: ${f.message}`).join('; ') },
        )}`,
      );
    } else {
      toast.success(t('COVERAGE_IMPORT_RESULT', { ok: created.length, total: named.length }));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Heading level="h3">{t('SECTION_COVERAGE')}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t('COVERAGE_HELP')}
        </Text>
      </div>

      {visible.length === 0 && editing === null && importing === null && (
        <Text size="small" className="text-ui-fg-subtle">
          {t('COVERAGE_EMPTY')}
        </Text>
      )}

      <div className="flex flex-col gap-2">
        {visible.map((item) => (
          <CoverageRow
            key={item.key}
            item={item}
            onEdit={() => setEditing(item.key)}
            onDelete={() => deleteDraft(item.key)}
            // Editar o borrar en medio del lote pisaría la lista cuando la
            // importación hace su `onChange` al final.
            disabled={progress?.running ?? false}
          />
        ))}
      </div>

      {importing !== null ? (
        <ImportPanel
          result={importing.result}
          fileName={importing.fileName}
          progress={progress}
          onImport={runImport}
          onCancel={() => {
            setImporting(null);
            setProgress(null);
          }}
        />
      ) : editing === null ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => setEditing('new')}>
            <Plus />
            {t('COVERAGE_ADD')}
          </Button>
          {/* Importar un archivo multi-área es su propio camino: acá el archivo
              manda cuántas zonas se crean, no una sola. */}
          <label className="inline-flex">
            <Button variant="secondary" asChild>
              <span>{t('COVERAGE_IMPORT_OPEN')}</span>
            </Button>
            <input
              type="file"
              accept=".geojson,.json,application/geo+json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      ) : (
        <CoverageEditor
          initial={editing === 'new' ? emptyCoverageDraft() : (editingDraft as CoverageDraft)}
          center={center}
          onDone={upsertDraft}
          onCancel={() => setEditing(null)}
          onMultiArea={openImport}
        />
      )}
    </div>
  );
};
