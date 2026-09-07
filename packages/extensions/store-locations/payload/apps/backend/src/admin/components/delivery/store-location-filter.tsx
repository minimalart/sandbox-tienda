import { Select } from '@medusajs/ui';
import { useStoreLocations } from '../../hooks/api/store-locations';

/**
 * M10 — Selector reutilizable de sucursal (store_location) para scopear la
 * operación logística por tienda. Lo usan el ops board, el Control Tower y el
 * Route Planner.
 *
 * Modelo de valor: usa el sentinel '__all' para "Todas" porque @medusajs/ui
 * Select no admite Item con value="". El padre recibe `string | undefined`
 * (undefined = sin filtro) vía onChange, ya traducido.
 *
 * Pega al endpoint admin de store-locations vía el hook ya existente
 * (useStoreLocations). Sin estado propio: es controlado por el padre.
 */
const ALL = '__all';

export type StoreLocationFilterProps = {
  /** store_location_id seleccionado, o undefined = todas. */
  value?: string;
  /** Devuelve el id seleccionado, o undefined cuando se elige "Todas". */
  onChange: (storeLocationId: string | undefined) => void;
  /** Ancho del trigger (clase tailwind). Default w-[200px]. */
  className?: string;
  /** Texto de la opción "todas". Default "Todas las sucursales". */
  allLabel?: string;
};

export const StoreLocationFilter = ({
  value,
  onChange,
  className = 'w-[200px]',
  allLabel = 'Todas las sucursales',
}: StoreLocationFilterProps) => {
  const { data } = useStoreLocations({ limit: 200 });
  const locations = data?.store_locations ?? [];

  return (
    <Select
      value={value ?? ALL}
      onValueChange={(v) => onChange(v === ALL ? undefined : v)}
    >
      <Select.Trigger className={className}>
        <Select.Value placeholder="Sucursal" />
      </Select.Trigger>
      <Select.Content className="z-[60]">
        <Select.Item value={ALL}>{allLabel}</Select.Item>
        {locations.map((loc) => (
          <Select.Item key={loc.id} value={loc.id}>
            {loc.name}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  );
};

export default StoreLocationFilter;
