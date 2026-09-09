/**
 * Opciones canónicas del loader de Google Maps.
 *
 * `useJsApiLoader` de `@react-google-maps/api` mantiene UN solo loader por
 * documento (id por defecto `script-loader`) y lanza
 * `Error: Loader must not be called again with different options` en cuanto un
 * segundo consumidor lo instancia con opciones distintas a las del primero.
 *
 * En App Router la navegación es client-side y el módulo del loader no se
 * reinicia, así que el error no aparece en la carga inicial: aparece al
 * NAVEGAR. El primer mapa que monta fija las opciones y el siguiente explota,
 * cayendo al error boundary de `(main)/error.tsx` — el famoso
 * "No pudimos cargar esta sección" (DESDEELSUR-52, DESDEELSUR-54). Un F5 lo
 * "arregla" porque vuelve a ganar la página que se cargó primero.
 *
 * Por eso TODO consumidor de `useJsApiLoader` importa estas libraries en lugar
 * de declarar las suyas. Es el superset de lo que el sitio necesita:
 * - `places`: autocomplete del buscador de sucursales y de las direcciones.
 * - `marker`: markers del mapa.
 *
 * `google-maps-loader.test.ts` falla si alguien vuelve a declarar una lista
 * propia.
 */
export const GOOGLE_MAPS_LIBRARIES: ("places" | "marker")[] = [
  "places",
  "marker",
];
