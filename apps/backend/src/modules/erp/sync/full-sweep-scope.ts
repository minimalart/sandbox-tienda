/**
 * Qué hace el barrido completo, y qué NO.
 *
 * Decisiones PURAS (testeables sin container) sobre el alcance de dos fases que
 * en un barrido completo son caras y que no todo el mundo quiere pagar en cada
 * corrida. Vivían sueltas en `run-catalog-sync.ts` como condiciones en línea; acá
 * tienen nombre, tests y un solo dueño.
 *
 * El barrido completo (`full_sweep_hour`, sin `fechasincro`) existe por una razón
 * concreta: el ERP no informa bajas, así que el delta solo nunca se enteraría de
 * un artículo despublicado. Pero "traer el catálogo entero" no obliga a rehacer
 * TODO el trabajo sobre el catálogo entero, y ahí es donde estas dos opciones
 * dejan elegir.
 */

/** Sobre qué filas corre la fase de imágenes. */
export type ImagePhaseScope =
  /** Catálogo COMPLETO: hay un backfill pendiente. */
  | 'backfill'
  /** Solo los artículos que el ERP marcó modificados. */
  | 'delta'
  /** Catálogo COMPLETO porque el operador pidió revisar imágenes en el barrido. */
  | 'full_sweep'
  /** La fase no corre. */
  | 'skipped';

/**
 * Alcance de la fase de imágenes.
 *
 * El caso interesante es `skipped`, que es el default en un barrido completo.
 * `planProductImages` descarta todo producto que ya tiene foto, así que lo que
 * sobrevive en un barrido completo son justamente los artículos SIN imagen — y en
 * la cuenta real 878 de 2.547 no la tienen en el ERP tampoco. Volver a
 * preguntarle por esos 878 en cada barrido es transferencia y latencia para una
 * respuesta que ya sabemos, y que sólo cambia si el artículo cambia — y eso entra
 * por el delta: cargarle la foto en el ERP le mueve la fecha de modificación.
 *
 * `scanOnFullSweep` existe porque ese razonamiento asume que el ERP mueve la
 * fecha al cargar una foto. Es lo que hace Zeus, pero es un supuesto sobre un
 * sistema ajeno: si algún ERP carga imágenes sin tocar el artículo, las fotos
 * nuevas no entrarían nunca por el delta y hay que barrer. Prenderlo es la salida,
 * y cuesta una pasada completa por corrida.
 */
export function resolveImagePhaseScope(input: {
  /** `catalog_sync.images.backfill_pending`. */
  backfillPending: boolean;
  /** La corrida ya trae el catálogo completo (`since === null`). */
  fullCatalogRun: boolean;
  /** `catalog_sync.full_sweep.images`. */
  scanOnFullSweep: boolean;
}): ImagePhaseScope {
  // El backfill manda: es una pasada única que alguien pidió explícitamente.
  if (input.backfillPending) return 'backfill';
  if (!input.fullCatalogRun) return 'delta';
  return input.scanOnFullSweep ? 'full_sweep' : 'skipped';
}

/**
 * ¿Se escriben las price lists en esta corrida?
 *
 * Default `true`, y el default importa: el barrido completo es la RED DE
 * SEGURIDAD de los precios. Si el watermark se corrió, o el ERP no informó una
 * modificación, el delta se pierde ese cambio para siempre y el barrido es lo
 * único que lo arrastra. Apagarlo deja los precios mayoristas dependiendo
 * exclusivamente de que el ERP informe bien cada cambio.
 *
 * Se ofrece igual porque el costo del barrido no es simétrico: con varias listas
 * mapeadas, cada una es una lectura de todos los precios de esa price list más
 * las escrituras de los que difieren, y en un catálogo grande eso es la parte
 * pesada de la corrida. El precio BASE no se toca nunca con esto: es lo que ve el
 * comprador y lo que el barrido tiene que garantizar.
 */
export function shouldWritePriceListsOnRun(input: {
  /** La corrida es un barrido completo. */
  fullSweep: boolean;
  /** `catalog_sync.full_sweep.price_lists`. */
  writeOnFullSweep: boolean;
}): boolean {
  if (!input.fullSweep) return true;
  return input.writeOnFullSweep;
}
