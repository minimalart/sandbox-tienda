import { useTranslation } from 'react-i18next';
import {
  PolygonMapPicker,
  type PolygonMapPickerProps,
  type PolygonPickerLabels,
} from '../../../components/geo/polygon-map-picker';

/**
 * El picker de polígonos de las coberturas de una sucursal.
 *
 * El mapa y toda la lógica de dibujo viven en `components/geo/polygon-map-picker`,
 * que es CORE y no habla i18n: las zonas del store locator (extensión
 * `multistore`) usan el mismo componente con su propio namespace, y una de las
 * dos extensiones puede no estar instalada. Acá sólo se le pasan los textos de
 * `storeLocations`.
 */
export const PolygonPicker = (props: Omit<PolygonMapPickerProps, 'labels'>) => {
  const { t } = useTranslation('storeLocations');

  const labels: PolygonPickerLabels = {
    upload: t('COVERAGE_UPLOAD'),
    draw: t('COVERAGE_DRAW'),
    drawFinish: t('COVERAGE_DRAW_FINISH'),
    drawUndo: t('COVERAGE_DRAW_UNDO'),
    drawCancel: t('COVERAGE_DRAW_CANCEL'),
    drawNeedThree: t('COVERAGE_DRAW_NEED_THREE'),
    clear: t('COVERAGE_CLEAR'),
    points: (n) => t('COVERAGE_PREVIEW_POINTS', { n }),
    drawHint: t('COVERAGE_DRAW_HINT'),
    editHint: t('COVERAGE_EDIT_HINT'),
    mapHint: t('COVERAGE_MAP_HINT'),
    geojsonError: t('COVERAGE_GEOJSON_ERROR'),
    geojsonMulti: (n) => t('COVERAGE_GEOJSON_MULTI', { n }),
    geojsonHoles: (n) => t('COVERAGE_GEOJSON_HOLES', { n }),
    geojsonDiscarded: (n) => t('COVERAGE_GEOJSON_DISCARDED', { n }),
    mapsLoading: t('MAPS_LOADING'),
    mapsKeyError: t('MAPS_KEY_ERROR'),
    mapsNoKeyHint: t('MAPS_NO_KEY_HINT'),
  };

  return <PolygonMapPicker labels={labels} {...props} />;
};
