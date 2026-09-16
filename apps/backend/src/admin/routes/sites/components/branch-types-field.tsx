import { Button, IconButton, Input, Label, Select, Switch, Text } from '@medusajs/ui';
import { ArrowDownMini, ArrowUpMini, Plus, Trash } from '@medusajs/icons';
import {
  BRANCH_TYPE_COLOR_ORDER,
  MAX_BRANCH_TYPES,
  branchTypeColor,
  nextBranchTypeColor,
  slugifyBranchType,
  type BranchType,
  type BranchTypeColor,
} from '../../../../lib/branch-types';

/** Muestra de color de la paleta. Hex fijos, no clases de Tailwind armadas en runtime. */
const SWATCH: Record<BranchTypeColor, { hex: string; label: string }> = {
  primary: { hex: '#3B82F6', label: 'Color de la tienda' },
  green: { hex: '#059669', label: 'Verde' },
  blue: { hex: '#2563EB', label: 'Azul' },
  slate: { hex: '#475569', label: 'Gris' },
  purple: { hex: '#7C3AED', label: 'Violeta' },
  amber: { hex: '#D97706', label: 'Ámbar' },
  red: { hex: '#DC2626', label: 'Rojo' },
  teal: { hex: '#0D9488', label: 'Verde azulado' },
};

const Dot = ({ color }: { color: BranchTypeColor }) => (
  <span
    aria-hidden
    className="inline-block h-3 w-3 shrink-0 rounded-full"
    style={{ backgroundColor: SWATCH[color].hex }}
  />
);

/** Mueve `from` a `to` devolviendo un array nuevo. */
const move = <T,>(rows: T[], from: number, to: number): T[] => {
  const next = rows.filter((_, i) => i !== from);
  next.splice(to, 0, ...rows.slice(from, from + 1));
  return next;
};

/**
 * Los tipos de sucursal de la tienda.
 *
 * Reemplaza al bloque de tres switches con los tipos clavados en el código
 * (`point_of_sale` / `wholesale` / `distribution_center`). Ahora la lista es
 * abierta: se agregan, se renombran, se ordenan y se borran.
 *
 * Tres cosas que no son obvias:
 *
 *  - El **id** se genera del nombre al crear el tipo y después NO cambia:
 *    `store_location.store_type` lo referencia y no hay foreign key que
 *    arrastre un rename. Por eso el nombre se edita libremente y el id ni se
 *    muestra.
 *  - El **orden** de la lista es el orden en que el storefront ordena las
 *    sucursales y muestra los chips del filtro.
 *  - "Permite retiro" decide si las sucursales de ese tipo aparecen en el paso
 *    "Retiro en tienda" del checkout. Antes eso era un
 *    `!== 'distribution_center'` hardcodeado en el storefront.
 *
 * Una lista VACÍA es un estado válido y explícito: la tienda no clasifica sus
 * sucursales, y no se muestran ni el filtro de categoría ni las etiquetas.
 */
export const BranchTypesField = ({
  value,
  onChange,
}: {
  value: BranchType[];
  onChange: (types: BranchType[]) => void;
}) => {
  const update = (index: number, patch: Partial<BranchType>) =>
    onChange(value.map((type, i) => (i === index ? { ...type, ...patch } : type)));

  const add = () =>
    onChange([
      ...value,
      {
        id: slugifyBranchType(
          'tipo',
          value.map((type) => type.id)
        ),
        label: '',
        pickup: true,
        color: nextBranchTypeColor(value),
      },
    ]);

  const remove = (index: number) => {
    const name = value[index]?.label?.trim() || 'este tipo';
    // Sin confirmación sería un borrado silencioso con consecuencias en otra
    // pantalla: las sucursales que lo usan quedan sin tipo y el operador se
    // entera recién al abrirlas.
    const message =
      'Se va a eliminar "' + name + '". Las sucursales que lo usan quedarán sin tipo.';
    if (!window.confirm(message)) return;
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>Tipos de sucursal</Label>
      {value.length === 0 ? (
        <Text size="small" className="text-ui-fg-muted">
          Esta tienda no clasifica sus sucursales: no se muestra el filtro por categoría ni la
          etiqueta de tipo.
        </Text>
      ) : (
        <div className="flex flex-col gap-2">
          {value.map((type, index) => {
            const color = branchTypeColor(type, index);
            return (
              <div
                key={type.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-ui-border-base p-2"
              >
                <Select
                  value={color}
                  onValueChange={(next) => update(index, { color: next as BranchTypeColor })}
                >
                  <Select.Trigger
                    className="w-[64px] shrink-0"
                    aria-label={'Color de ' + (type.label || 'este tipo')}
                  >
                    <Dot color={color} />
                  </Select.Trigger>
                  {/* z-[70]: el drawer de la tienda ya es z-[60]. */}
                  <Select.Content className="z-[70]">
                    {BRANCH_TYPE_COLOR_ORDER.map((option) => (
                      <Select.Item key={option} value={option}>
                        <span className="flex items-center gap-2">
                          <Dot color={option} />
                          {SWATCH[option].label}
                        </span>
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>

                <Input
                  className="min-w-[160px] flex-1"
                  aria-label="Nombre del tipo"
                  placeholder="Punto de venta"
                  value={type.label}
                  onChange={(e) => update(index, { label: e.target.value })}
                />

                <div className="flex items-center gap-2">
                  <Text size="small" className="whitespace-nowrap text-ui-fg-subtle">
                    Permite retiro
                  </Text>
                  <Switch
                    aria-label={'Permite retiro en ' + (type.label || 'este tipo')}
                    checked={type.pickup}
                    onCheckedChange={(pickup) => update(index, { pickup })}
                  />
                </div>

                <div className="ml-auto flex items-center">
                  <IconButton
                    size="small"
                    variant="transparent"
                    type="button"
                    aria-label="Subir"
                    disabled={index === 0}
                    onClick={() => onChange(move(value, index, index - 1))}
                  >
                    <ArrowUpMini />
                  </IconButton>
                  <IconButton
                    size="small"
                    variant="transparent"
                    type="button"
                    aria-label="Bajar"
                    disabled={index === value.length - 1}
                    onClick={() => onChange(move(value, index, index + 1))}
                  >
                    <ArrowDownMini />
                  </IconButton>
                  <IconButton
                    size="small"
                    variant="transparent"
                    type="button"
                    aria-label="Eliminar"
                    onClick={() => remove(index)}
                  >
                    <Trash />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <Button
          type="button"
          size="small"
          variant="secondary"
          disabled={value.length >= MAX_BRANCH_TYPES}
          onClick={add}
        >
          <Plus /> Agregar tipo
        </Button>
      </div>
    </div>
  );
};
