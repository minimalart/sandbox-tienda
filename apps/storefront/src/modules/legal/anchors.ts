import type { LegalSection } from '@lib/data/legal-pages'

export type LegalTocEntry = {
  /** Id del `<details>` y destino del link del índice. */
  anchor: string
  /** Nombre tal cual lo escribió el operador. */
  name: string
}

/**
 * Ancla de una sección, derivada de su NOMBRE.
 *
 * Del nombre y no del `id` guardado a propósito: el `id` existe para que el editor
 * del backoffice pueda reordenar filas y es opaco (`s3`, un uuid), así que produciría
 * URLs como `/legal/conditions#s3`. El nombre produce `#precios-y-medios-de-pago`,
 * que es la clase de link que alguien pega en un mail.
 *
 * El precio es que renombrar una sección le cambia el ancla. Para el índice de la
 * propia página no cambia nada —los dos lados se derivan del mismo nombre en el mismo
 * render— y un link externo a una cláusula que cambió de nombre probablemente tenga
 * que revisarse igual.
 */
const slugify = (name: string): string =>
  name
    .normalize('NFD')
    // Marcas diacríticas: `NFD` separa "ó" en "o" + tilde, y esto descarta la tilde.
    // El rango va ESCAPADO (`\u0300-\u036f`) y no con los caracteres literales: son
    // combinantes, así que en el código fuente se pegan al corchete anterior y el
    // archivo queda ilegible o directamente roto según el editor que lo abra.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * El índice de la página: un ancla por sección, GARANTIZADAMENTE única.
 *
 * La deduplicación no es defensiva de más: nada impide que el operador tenga dos
 * secciones llamadas "Excepciones", y con anclas repetidas el índice mandaría las dos
 * al mismo panel. Un `-2` es peor que nada sólo si nadie lo ve; dos links que van al
 * mismo lugar se reportan como bug.
 *
 * Una sección cuyo nombre no deja ningún carácter usable (sólo emoji, sólo signos)
 * cae a `seccion-<n>`: sin eso el ancla quedaría vacía y el link no navegaría.
 */
export function buildLegalToc(sections: LegalSection[]): LegalTocEntry[] {
  const seen = new Map<string, number>()

  return sections.map((section, index) => {
    const base = slugify(section.name) || `seccion-${index + 1}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return {
      anchor: count === 0 ? base : `${base}-${count + 1}`,
      name: section.name,
    }
  })
}
