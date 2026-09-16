import { Button, Drawer, IconButton, Input, Label, Switch, Text, toast } from '@medusajs/ui';
import { Plus, Trash } from '@medusajs/icons';
import { useMemo, useState } from 'react';
import {
  PolygonMapPicker,
  type PolygonPickerLabels,
} from '../../../components/geo/polygon-map-picker';
import {
  polygonPointsToRing,
  ringToPolygonPoints,
} from '../../../components/geo/geojson-areas';
import type { PolygonPoint } from '../../../components/geo/types';
import { GEO_ZONES_AR_INDEX } from '../../../../lib/geo-zones-ar-index';
import type { StoreLocatorZoneConfig } from '../../../../lib/store-locator-config';

/**
 * Textos del picker del mapa. Viven acá y no en i18n porque el bloque entero de
 * la ficha de la tienda está escrito en español directo (igual que el textarea
 * de GeoJSON al que reemplaza).
 */
const MAP_LABELS: PolygonPickerLabels = {
  upload: 'Subir GeoJSON',
  draw: 'Dibujar en el mapa',
  drawFinish: 'Cerrar polígono',
  drawUndo: 'Deshacer punto',
  drawCancel: 'Cancelar',
  drawNeedThree: 'Una zona necesita al menos 3 puntos.',
  clear: 'Borrar polígono',
  points: (n) => `${n} puntos`,
  drawHint: 'Hacé clic en el mapa para ir marcando el contorno.',
  editHint: 'Arrastrá los vértices para ajustar. Clic derecho sobre uno lo elimina.',
  mapHint: 'Dibujá la zona en el mapa o subí un archivo .geojson.',
  geojsonError: 'No se pudo leer el archivo: revisá que sea un GeoJSON válido.',
  geojsonMulti: (n) => `El archivo trae ${n} áreas: se usó la primera.`,
  geojsonHoles: (n) => `Se ignoraron ${n} agujeros del polígono.`,
  geojsonDiscarded: (n) => `Se descartaron ${n} áreas que no se pudieron usar.`,
  mapsLoading: 'Cargando el mapa…',
  mapsKeyError: 'No se pudo cargar Google Maps: revisá la API key.',
  mapsNoKeyHint: 'Falta VITE_GOOGLE_MAPS_API_KEY: podés subir un .geojson igual.',
};

const isPreset = (
  zone: StoreLocatorZoneConfig
): zone is Extract<StoreLocatorZoneConfig, { preset: string }> => 'preset' in zone;

const geometryOf = (zone: StoreLocatorZoneConfig) => ('geometry' in zone ? zone.geometry : null);

/** Cantidad de vértices de una zona propia, para mostrar en la fila. */
const vertexCount = (zone: StoreLocatorZoneConfig): number => {
  const geometry = geometryOf(zone);
  if (!geometry) return 0;
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.reduce((total, rings) => total + (rings[0]?.length ?? 0), 0);
};

/** Slug único para una zona propia nueva, a partir del nombre. */
const zoneId = (label: string, taken: Set<string>): string => {
  const base =
    label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'zona';
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
};

/**
 * Drawer anidado para crear o editar una zona propia. `z-[70]` porque el drawer
 * de la ficha de la tienda ya es `z-[60]`.
 */
const ZoneDrawer = ({
  zone,
  taken,
  onSave,
  onClose,
}: {
  /** `null` = crear una zona nueva. */
  zone: StoreLocatorZoneConfig | null;
  taken: Set<string>;
  onSave: (zone: StoreLocatorZoneConfig) => void;
  onClose: () => void;
}) => {
  const [label, setLabel] = useState(zone?.label ?? '');
  // El picker trabaja con `{x,y}` strings; la zona se persiste como GeoJSON.
  const [polygon, setPolygon] = useState<PolygonPoint[]>(() => {
    const geometry = zone ? geometryOf(zone) : null;
    if (!geometry) return [];
    const ring =
      geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0]?.[0];
    return ring ? ringToPolygonPoints(ring) : [];
  });

  const save = () => {
    const name = label.trim();
    if (!name) {
      toast.error('Poné un nombre para la zona.');
      return;
    }
    const ring = polygonPointsToRing(polygon);
    // 4 y no 3: el anillo ya viene cerrado, así que el último punto repite al
    // primero. Es el mismo mínimo que valida el schema del backend.
    if (ring.length < 4) {
      toast.error('Dibujá la zona en el mapa o subí un archivo .geojson.');
      return;
    }
    onSave({
      id: zone?.id ?? zoneId(name, taken),
      label: name,
      geometry: { type: 'Polygon', coordinates: [ring] },
      ...(zone && 'active' in zone && zone.active === false ? { active: false } : {}),
    });
  };

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content className="z-[70]">
        <Drawer.Header>
          <Drawer.Title>{zone ? 'Editar zona' : 'Nueva zona'}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <Label htmlFor="zone-name">Nombre</Label>
            <Input
              id="zone-name"
              placeholder="Zona Norte"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <PolygonMapPicker labels={MAP_LABELS} value={polygon} onChange={setPolygon} editable />
        </Drawer.Body>
        <Drawer.Footer>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={save}>
            Guardar
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

/**
 * Las zonas del filtro "Ubicación" de /sucursales.
 *
 * Reemplaza al `<Textarea>` de GeoJSON crudo, que estaba vacío en todas las
 * tiendas — con razón: nadie pega un MultiPolygon a mano, así que el filtro de
 * ubicación no se veía nunca en ninguna parte.
 *
 * Dos clases de zona conviven en la misma lista:
 *
 *  - Las **del catálogo argentino**: se prenden con un switch y se guardan por
 *    REFERENCIA (`{ preset: 'ar-b' }`). No llevan geometría porque el
 *    `content_config` viaja entero en cada guardado y el POST del admin corta
 *    arriba de ~100 KB; además, si mañana mejoramos los polígonos todas las
 *    tiendas se benefician sin tocar su fila. Apagarlas las saca de la lista:
 *    no hay nada que conservar.
 *  - Las **propias**: se dibujan en el mapa (o se importan de un `.geojson`) y
 *    guardan su `geometry`. Apagarlas NO las borra, las deja `active: false`,
 *    porque ahí sí se perdería el trabajo de alguien.
 */
export const LocationZonesField = ({
  value,
  onChange,
}: {
  value: StoreLocatorZoneConfig[];
  onChange: (zones: StoreLocatorZoneConfig[]) => void;
}) => {
  const [search, setSearch] = useState('');
  /** `undefined` = cerrado; `null` = creando; una zona = editándola. */
  const [editing, setEditing] = useState<StoreLocatorZoneConfig | null | undefined>(undefined);

  const enabledPresets = useMemo(
    () => new Set(value.filter(isPreset).map((zone) => zone.preset)),
    [value]
  );
  const customZones = value.filter((zone) => !isPreset(zone));
  const takenIds = useMemo(() => new Set(value.map((zone) => zone.id)), [value]);

  const presets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return GEO_ZONES_AR_INDEX;
    return GEO_ZONES_AR_INDEX.filter((zone) => zone.label.toLowerCase().includes(needle));
  }, [search]);

  const togglePreset = (preset: { id: string; label: string }, enabled: boolean) => {
    if (!enabled) {
      onChange(value.filter((zone) => !(isPreset(zone) && zone.preset === preset.id)));
      return;
    }
    onChange([...value, { id: preset.id, label: preset.label, preset: preset.id }]);
  };

  const upsertCustom = (zone: StoreLocatorZoneConfig) => {
    const exists = value.some((current) => current.id === zone.id);
    onChange(exists ? value.map((current) => (current.id === zone.id ? zone : current)) : [...value, zone]);
    setEditing(undefined);
  };

  return (
    <div className="flex flex-col gap-3">
      <Label>Zonas de ubicación</Label>

      <div className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-3">
        <div className="flex items-center justify-between gap-2">
          <Text size="small" weight="plus">
            Zonas de Argentina
          </Text>
          <Input
            className="max-w-[180px]"
            size="small"
            placeholder="Buscar provincia"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid max-h-[220px] grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto sm:grid-cols-2">
          {presets.map((preset) => (
            <label key={preset.id} className="flex items-center gap-2 py-1">
              <Switch
                checked={enabledPresets.has(preset.id)}
                onCheckedChange={(enabled) => togglePreset(preset, enabled)}
              />
              <Text size="small">{preset.label}</Text>
            </label>
          ))}
          {presets.length === 0 && (
            <Text size="small" className="text-ui-fg-muted">
              Sin resultados.
            </Text>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Text size="small" weight="plus">
          Zonas propias
        </Text>
        {customZones.length === 0 ? (
          <Text size="small" className="text-ui-fg-muted">
            Todavía no creaste ninguna.
          </Text>
        ) : (
          customZones.map((zone) => (
            <div
              key={zone.id}
              className="flex items-center gap-2 rounded-lg border border-ui-border-base p-2"
            >
              <Switch
                aria-label={'Mostrar ' + zone.label}
                checked={zone.active !== false}
                onCheckedChange={(active) =>
                  onChange(
                    value.map((current) =>
                      current.id === zone.id ? { ...current, active } : current
                    )
                  )
                }
              />
              <div className="flex flex-col">
                <Text size="small" weight="plus">
                  {zone.label}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {vertexCount(zone)} puntos
                </Text>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <Button type="button" size="small" variant="transparent" onClick={() => setEditing(zone)}>
                  Editar
                </Button>
                <IconButton
                  size="small"
                  variant="transparent"
                  type="button"
                  aria-label={'Eliminar ' + zone.label}
                  onClick={() => onChange(value.filter((current) => current.id !== zone.id))}
                >
                  <Trash />
                </IconButton>
              </div>
            </div>
          ))
        )}
        <div>
          <Button type="button" size="small" variant="secondary" onClick={() => setEditing(null)}>
            <Plus /> Nueva zona
          </Button>
        </div>
      </div>

      {editing !== undefined && (
        <ZoneDrawer
          zone={editing}
          taken={takenIds}
          onSave={upsertCustom}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
};
