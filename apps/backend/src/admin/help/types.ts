/**
 * Ayuda de extensiones: el texto largo que hoy vive apilado en la UI.
 *
 * El admin acumuló ~27 `description` de varias oraciones, ~100 `help` de más de
 * 140 caracteres (el peor, `descriptors/delivery.ts`, tiene 480) y cinco bloques
 * numerados de "cómo funciona" incrustados entre los campos. Nada de eso es
 * mentira; el problema es que está TODO visible TODO el tiempo, así que la
 * pantalla de ajustes se lee como un manual y el campo que el operador vino a
 * cambiar queda enterrado. Este módulo es a dónde se muda ese texto.
 *
 * IMPORTANTE — igual que `modules/app-settings/descriptors/types.ts`, esto lo
 * importa el bundle del admin: tienen que ser DATOS PUROS. Sin `node:*`, sin
 * DOM, sin `process.env` en scope de módulo, sin side effects. El renderer
 * (`render.ts`) también es puro, justamente para que el test de sincronía y el
 * script generador compartan la misma función sin arrastrar `fs` al browser.
 *
 * ─── Por qué el contenido vive en TypeScript y el markdown se genera ─────────
 *
 * La fuente tiene que ser una sola: si el drawer y `docs/extensions/*.md` se
 * escriben aparte, divergen, y la doc que nadie mira miente antes del mes.
 *
 * La alternativa era la inversa —el `.md` como fuente, leído desde el admin con
 * el `?raw` de Vite— y se descartó por su modo de falla. El admin de Medusa no
 * expone su config de bundler, así que `?raw` es una apuesta a un import que
 * nadie de este repo controla; y cuando falla no explota: devuelve vacío y la
 * ayuda DESAPARECE en silencio. Es exactamente el modo de falla que
 * `common/site-scope-bar.tsx` ya rechaza para la barra de tienda.
 *
 * Con TS como fuente, el markdown es un artefacto derivado y la sincronía es un
 * invariante que un test hace cumplir en CI — que es como este repo ya resuelve
 * este tipo de problema (`migration-names.test.ts`, `admin-site-scope.test.ts`).
 */

/** Enlace al pie de una sección. `href` puede ser externo o relativo al admin. */
export type HelpLink = {
  label: string;
  href: string;
};

export type HelpSection = {
  heading: string;
  /**
   * Uno o más párrafos, separados por línea en blanco. Texto plano: sin HTML y
   * sin markdown inline. El drawer lo renderiza como `<Text>` y el generador lo
   * vuelca tal cual, así que cualquier sintaxis se vería cruda en uno de los dos
   * lados — y el que se rompe siempre es el que nadie está mirando.
   */
  body: string;
  /**
   * Pasos ordenados. Van acá y no dentro de `body` porque son la mitad del
   * motivo de este módulo: los bloques numerados que hoy están incrustados en la
   * UI (`brands/components/brand-csv-bulk.tsx` son ~75 líneas de JSX para una
   * lista de pasos) se vuelven datos y dejan de ser layout.
   */
  steps?: string[];
  links?: HelpLink[];
};

export type ExtensionHelp = {
  /** Encabezado del drawer y `# título` del markdown generado. */
  title: string;
  /**
   * UNA oración: qué hace la extensión. Es también lo que queda visible como
   * `description` de `ExtensionSettingsCard` una vez adelgazada, así que si acá
   * hacen falta dos oraciones, la segunda es una sección.
   */
  summary: string;
  sections: HelpSection[];
};

/**
 * Identidad tipada. No valida nada en runtime a propósito: lo que hay que
 * garantizar —que el markdown en disco corresponda a estos datos— no se puede
 * chequear desde el bundle del admin, y por eso vive en `docs-sync.test.ts`.
 */
export const defineHelp = (help: ExtensionHelp): ExtensionHelp => help;
