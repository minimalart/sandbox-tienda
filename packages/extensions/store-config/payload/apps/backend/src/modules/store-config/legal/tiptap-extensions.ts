import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import type { Extensions } from '@tiptap/core';

/**
 * El set de extensiones del editor de LEGALES.
 *
 * Deliberadamente MÁS CHICO que el del blog (`modules/blog/tiptap-extensions.ts`) y
 * deliberadamente SEPARADO de él, por dos razones distintas:
 *
 *  - Más chico: un texto legal tiene títulos, párrafos, listas, negrita y links. No
 *    lleva imágenes, videos, colores ni tablas resizables. Cada extensión de más es
 *    un botón que el operador puede usar y que después el sanitizador borra sin
 *    avisar — el fallo silencioso que este módulo evita a propósito.
 *  - Separado: importar el del blog ataría la extensión `store-config` a que `blog`
 *    esté instalada. Peor: el composer saltea sin error un archivo con DOS dueños
 *    (`packages/project-composer`), así que el payload de una de las dos extensiones
 *    saldría incompleto y nadie se enteraría hasta el build del proyecto.
 *
 * `heading.levels` arranca en 3, no en 2, y los dos niveles de arriba ya están
 * tomados: el `h1` es el TÍTULO de la página (campo propio) y el `h2` es el NOMBRE DE
 * LA SECCIÓN (el encabezado del acordeón, también campo propio). Un `h2` dentro del
 * cuerpo daría dos encabezados del mismo nivel para el mismo panel y rompería el
 * outline del documento — que en una página legal es justo lo que usa un lector de
 * pantalla para navegar. `sanitizeLegalHtml` lo descarta igual; esto evita que el
 * botón exista.
 */
export function getLegalEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [3, 4] },
      // Sin `code` ni `codeBlock`: `sanitizeLegalHtml` no permite `pre` ni `code`, así
      // que el atajo de teclado (`` ` ``, y es fácil de apretar sin querer) produciría
      // un formato que desaparece al guardar.
      code: false,
      codeBlock: false,
    }),
    Underline,
    Link.configure({ openOnClick: false, autolink: true }),
  ];
}
