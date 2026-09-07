import { InformationCircle } from '@medusajs/icons';
import { Label, Tooltip } from '@medusajs/ui';

/**
 * Label de un ajuste con la aclaración larga en un tooltip en vez de en línea.
 *
 * Nació como `ErpSettingLabel` (`routes/erp/components/shared.tsx`) porque ERP
 * fue la primera extensión que se comió el problema: 18 de sus 42 ayudas pasan
 * los 120 caracteres y tres pasan los 300. En línea hacían dos cosas malas —
 * estiraban cada fila a varios renglones, y en las filas con `Switch` le comían
 * el ancho al control, porque en un flex el que cede es el hijo sin `shrink-0`.
 *
 * No es un problema de ERP: hay ~100 `help` de más de 140 caracteres repartidos
 * en los 37 descriptores, y el peor (`descriptors/delivery.ts`) tiene 480. Por
 * eso el componente sube acá y `SettingField` lo cablea: son ~100 filas que se
 * arreglan en un solo lugar en vez de extensión por extensión.
 *
 * Mismo patrón visual que `CardHeading` del commerce dashboard: `Tooltip` de
 * `@medusajs/ui` sobre un `InformationCircle` con `cursor-help`.
 *
 * NO se usa para los párrafos que introducen una SECCIÓN: esos orientan sobre
 * todo el bloque, no compiten con ningún control, y esconderlos detrás de un
 * ícono empeora la página. Ese texto va al drawer de ayuda (`src/admin/help/`).
 */

/**
 * A partir de acá una ayuda deja de leerse como aclaración y empieza a leerse
 * como párrafo. El número sale de medir los descriptores: por debajo la ayuda
 * entra en uno o dos renglones y en línea funciona mejor que un ícono que hay
 * que ir a buscar; por encima empuja el control y la fila deja de escanearse.
 */
export const LONG_HELP_THRESHOLD = 140;

export const isLongHelp = (help: string | undefined): help is string =>
  typeof help === 'string' && help.length > LONG_HELP_THRESHOLD;

/**
 * El ícono solo, para los rótulos que NO son un `<Label>`.
 *
 * Las pantallas de OPERACIÓN casi no tienen filas de ajuste: rotulan con
 * `<Heading>` (una sección de la página) o con `<Text weight="plus">` (el título
 * de un bloque). Degradarlos a `<Label>` para poder usar `SettingLabel` cambia
 * la tipografía y —en el caso del `Heading`— le saca el nivel al árbol de
 * encabezados, que es justo por donde navega un lector de pantalla. Se extrae el
 * ícono y se deja el rótulo como está.
 *
 * `label` no se pinta: es el nombre de la cosa que se está aclarando y va al
 * `aria-label`, igual que en `SettingLabel`, para que el ícono no se anuncie
 * como un "Ayuda" suelto entre varios idénticos.
 */
export function HintIcon({ hint, label }: { hint: string; label: string }): JSX.Element {
  return (
    <Tooltip content={hint}>
      <InformationCircle
        aria-label={`Ayuda: ${label}`}
        className="shrink-0 cursor-help text-ui-fg-muted transition-colors hover:text-ui-fg-subtle"
      />
    </Tooltip>
  );
}

export type SettingLabelProps = {
  label: string;
  /** Sin `hint` no se pinta el ícono: no todo ajuste necesita aclaración. */
  hint?: string;
  htmlFor?: string;
  size?: 'xsmall' | 'small' | 'base' | 'large';
  weight?: 'regular' | 'plus';
};

export function SettingLabel({
  label,
  hint,
  htmlFor,
  size,
  weight,
}: SettingLabelProps): JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Label htmlFor={htmlFor} size={size} weight={weight}>
        {label}
      </Label>
      {hint ? <HintIcon hint={hint} label={label} /> : null}
    </div>
  );
}
