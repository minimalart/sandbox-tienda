/**
 * QUÉ HACER CON LAS CONVERSACIONES QUE SE QUEDARON ESPERANDO.
 *
 * Un recorrido que pregunta se queda parado hasta que el cliente conteste. Si no
 * contesta nunca —abre el chat, ve la pregunta y se va— nadie vuelve a pensar en esa
 * conversación: no hay ningún momento en el que el bot la mire de nuevo. Queda
 * colgada para siempre, y la próxima vez que esa persona escriba, meses después, el
 * bot le contesta como si la pregunta siguiera en pie.
 *
 * El barrido es lo que le da ese momento. Este archivo decide A QUIÉN despertar y el
 * job sólo ejecuta: acá no hay contenedor, ni base, ni reloj propio.
 */

/** Lo que el barrido necesita saber de una conversación. Es un subconjunto de la fila. */
export type SleepingRow = {
  phone: string;
  /** El estado del recorrido tal como está guardado (`session.graph`). */
  graph: { version_id?: unknown; awaiting_until?: unknown } | null;
};

/** Las versiones publicadas hoy, con la tienda de cada una. */
export type LiveVersion = { versionId: string; siteId: string | null };

export type SweepPlan = {
  /** Vencidas y sobre una versión que sigue publicada: se las hace avanzar. */
  due: Array<{ phone: string; siteId: string | null }>;
  /**
   * Vencidas pero sobre una versión que ya no está publicada. No se las avanza: el
   * recorrido que estaban caminando ya no existe. Se les borra el estado, que es lo
   * que iba a pasar igual en cuanto el cliente escribiera — y si no se les borra,
   * el barrido las encuentra vencidas en cada pasada, para siempre.
   */
  stale: string[];
};

/**
 * Reparte las conversaciones vencidas entre las que se pueden avanzar y las que hay
 * que limpiar.
 *
 * El corte por fecha ya lo hizo la consulta; acá se decide sobre la VERSIÓN, que es
 * el dato que la consulta no puede cruzar sola. Y la tienda sale de la versión y no
 * de la conversación a propósito: la conversación no guarda de qué tienda es —el
 * webhook la sabe por su URL— pero el estado sí guarda qué versión está caminando, y
 * cada versión pertenece a una tienda. Un dato que ya estaba, usado para lo que
 * faltaba.
 *
 * Tiene un borde: una conversación que camina el recorrido GLOBAL despierta sin
 * tienda, aunque la persona le haya escrito a una. El recorrido que se ejecuta es el
 * correcto —es el mismo para todas— y lo único que pierde precisión son los eventos
 * de ese turno, que quedan sin tienda. Para arreglarlo habría que guardar la tienda
 * en la conversación, que hoy no la tiene: la sabe el webhook por su URL y no la
 * escribe en ningún lado.
 */
export function planTimeoutSweep(
  rows: readonly SleepingRow[],
  live: readonly LiveVersion[],
): SweepPlan {
  const siteByVersion = new Map(live.map((v) => [v.versionId, v.siteId]));
  const due: SweepPlan['due'] = [];
  const stale: string[] = [];

  for (const row of rows) {
    const versionId = typeof row.graph?.version_id === 'string' ? row.graph.version_id : null;
    if (!versionId || !siteByVersion.has(versionId)) {
      stale.push(row.phone);
      continue;
    }
    due.push({ phone: row.phone, siteId: siteByVersion.get(versionId) ?? null });
  }

  return { due, stale };
}

/**
 * El instante contra el que se compara, como lo guarda el estado.
 *
 * La comparación es entre STRINGS y no entre fechas, porque la consulta la hace
 * Postgres sobre json y ahí `awaiting_until` es texto. Funciona porque
 * `toISOString()` siempre devuelve el mismo formato de ancho fijo en UTC, así que el
 * orden alfabético y el cronológico son el mismo. Con fechas locales o de ancho
 * variable no lo serían.
 */
export const sweepCutoff = (now: Date = new Date()): string => now.toISOString();
