/**
 * Un vértice de polígono tal como se guarda: `{ x: lng, y: lat }` con las
 * coordenadas como STRING — el formato de `branch_coverage.polygon`.
 *
 * Vive en su propio archivo para que `geojson-areas` y `polygon-map-picker` no
 * se importen en círculo, y se declara acá (y no en el módulo `store-location`)
 * para que estos componentes no dependan de ninguna extensión: el tipo del
 * módulo es estructuralmente el mismo, así que se siguen pasando entre sí.
 */
export type PolygonPoint = { x: string; y: string };
