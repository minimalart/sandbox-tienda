/**
 * Memoria de qué artículos NO se les puede bajar la imagen, para que un puñado
 * de códigos rotos no bloquee el backfill entero.
 *
 * EL CASO REAL. En desdeelsur la fase de imágenes corrió cada 15 minutos durante
 * días con este resultado idéntico:
 *
 *     planned=914  imported=0  failed=18  aborted=true
 *
 * Zeus contesta **HTTP 500** al pedirle la imagen de ciertos artículos —no 404,
 * que sería "no tengo foto" y el adapter ya lo trata como `without_image`—. El
 * corte por 15 fallos seguidos existe para no insistirle 2.500 veces a un
 * endpoint caído, pero acá el endpoint está sano: es un SUBCONJUNTO de artículos
 * que siempre falla. Sin memoria de cuáles son, cada corrida reintenta los
 * mismos, muere en el mismo lugar e importa cero. Para siempre. Y el sync se
 * reporta `completed`.
 *
 * POR QUÉ TRES STRIKES Y NO UNO. Un 500 también es lo que devuelve un ERP caído.
 * Anotar al primer fallo dejaría medio catálogo en la lista negra por una caída
 * de diez minutos. Se exige que el artículo falle en TRES corridas distintas —no
 * tres reintentos dentro de la misma, que ya los hace `withRetries`— y recién
 * ahí se saltea. Con el sync cada 15 minutos son ~45 minutos hasta destrabarse,
 * contra el bloqueo indefinido de hoy.
 *
 * POR QUÉ CADUCA. Un artículo al que le cargan la foto en Zeus más tarde tiene
 * que volver a intentarse. Dos caminos, y los dos funcionan: cargar la foto le
 * mueve `fechahoramodife` y entra por el DELTA —donde esta lista ni se
 * consulta—, y además la entrada caduca sola a los 7 días.
 */

/** Un artículo que viene fallando, con cuántas corridas y desde cuándo. */
export type ImageFailureRecord = {
  /** Corridas DISTINTAS en las que falló. No son los reintentos internos. */
  count: number;
  last_failed_at: string;
};

/** Código de artículo → su historial de fallos. Vive en la config del ERP. */
export type ImageFailures = Record<string, ImageFailureRecord>;

/** Corridas fallidas antes de empezar a saltear el artículo. */
export const FAILURE_STRIKES = 3;

/** Días que se saltea un artículo antes de volver a probarlo. */
export const FAILURE_COOLDOWN_DAYS = 7;

/**
 * Tope de artículos recordados. La config del ERP es una columna JSON y esto no
 * puede crecer sin límite; cuando se pasa, se tiran los MÁS VIEJOS, que son los
 * que están más cerca de caducar igual.
 */
export const MAX_TRACKED_FAILURES = 5_000;

const DAY_MS = 24 * 60 * 60 * 1000;

const parseTime = (value: string): number => {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
};

/**
 * ¿Este artículo se saltea en esta corrida?
 *
 * Sólo si acumuló los strikes Y el último fallo está dentro del cooldown. Una
 * entrada vencida no saltea: se reintenta y, si vuelve a fallar, se renueva.
 */
export function shouldSkipImageFetch(
  failures: ImageFailures | undefined,
  code: string,
  now: Date
): boolean {
  const record = failures?.[code];
  if (!record || record.count < FAILURE_STRIKES) return false;
  return now.getTime() - parseTime(record.last_failed_at) < FAILURE_COOLDOWN_DAYS * DAY_MS;
}

/**
 * El estado nuevo de la lista después de una corrida.
 *
 * - lo que falló suma un strike y renueva la fecha,
 * - lo que importó bien se BORRA (el artículo se arregló: si vuelve a fallar,
 *   empieza de cero y no arrastra strikes viejos),
 * - lo vencido se poda, así la lista no crece con códigos que ya nadie mira.
 */
export function mergeImageFailures(
  existing: ImageFailures | undefined,
  outcome: { failed: readonly string[]; imported: readonly string[] },
  now: Date
): ImageFailures {
  const out: ImageFailures = {};
  const cutoff = now.getTime() - FAILURE_COOLDOWN_DAYS * DAY_MS;
  const imported = new Set(outcome.imported);

  for (const [code, record] of Object.entries(existing ?? {})) {
    if (imported.has(code)) continue;
    if (parseTime(record.last_failed_at) < cutoff) continue;
    out[code] = record;
  }

  const stamp = now.toISOString();
  for (const code of outcome.failed) {
    if (!code) continue;
    out[code] = { count: (out[code]?.count ?? 0) + 1, last_failed_at: stamp };
  }

  const codes = Object.keys(out);
  if (codes.length <= MAX_TRACKED_FAILURES) return out;

  // Se conservan los más RECIENTES: los viejos caducan antes y volverían a
  // intentarse igual.
  const keep = codes
    .sort((a, b) => parseTime(out[b]!.last_failed_at) - parseTime(out[a]!.last_failed_at))
    .slice(0, MAX_TRACKED_FAILURES);
  const capped: ImageFailures = {};
  for (const code of keep) capped[code] = out[code]!;
  return capped;
}

/** Cuántos artículos están hoy en cooldown, para el resumen del log. */
export function countSkippedByFailure(failures: ImageFailures | undefined, now: Date): number {
  let n = 0;
  for (const code of Object.keys(failures ?? {})) {
    if (shouldSkipImageFetch(failures, code, now)) n += 1;
  }
  return n;
}
