import type { ReactNode } from 'react';
import { registerSingleColumnLayout } from '@minimalart/mercatto-plugin-runtime/admin';

/**
 * Shell de una columna para las pantallas de ajustes: apila las cards de la
 * página y es el ÚNICO que decide cuánto se separan.
 *
 * ─── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
 *
 * Antes convivían cinco formas de apilar en las pantallas de ajustes: `<>` (sin
 * separación, y por eso algunas cards se ponían su propio `mb-4`), `gap-y-2`,
 * `gap-y-3`, `gap-y-4` y `gap-4`. El problema no es la variedad en sí: es que
 * con `<>` la card tiene que traer su propio margen, y ese margen se SUMA al gap
 * del día que el padre gane uno (16 + 16 = 32px). Con un shell que siempre
 * separa, ninguna card necesita margen propio y el espaciado deja de depender de
 * quién la monta.
 *
 * ─── POR QUÉ `gap-y-3` Y NO `gap-y-2` (que era el más frecuente acá) ─────────
 *
 * Porque es el valor de Medusa: `SingleColumnPage` / `TwoColumnPage` del
 * dashboard apilan sus secciones con `flex w-full flex-col gap-y-3`
 * (`@medusajs/dashboard`). Las pantallas de extensión se ven al lado de las
 * nativas —y a veces intercaladas en el mismo menú—, así que copiar el valor del
 * host es lo único que hace que no se note el borde entre unas y otras.
 * `gap-y-2` era el más repetido, pero era mayoría por copiar y pegar, no por una
 * decisión; y con las cards ya sin `mb-4` propio, 8px las deja casi pegadas.
 */
export type SingleColumnLayoutProps = {
  children: ReactNode;
};

export const SingleColumnLayout = ({ children }: SingleColumnLayoutProps) => {
  return <div className="flex flex-col gap-y-3">{children}</div>;
};

// Registrar en el runtime contract: los plugins publicados envuelven sus
// pantallas de ajustes con el MISMO shell vía el slot `SingleColumnLayout`,
// heredando la separación canónica (`gap-y-3`, alineada con `SingleColumnPage`
// del dashboard de Medusa) sin duplicar el componente en cada plugin.
registerSingleColumnLayout(SingleColumnLayout);
