import { Trash } from '@medusajs/icons';
import { Badge, IconButton, Input, Select, Switch, Text } from '@medusajs/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactElement } from 'react';

import { sdk } from '../../../../lib/client';

/**
 * QUÉ PRODUCTOS MUESTRA ESTE PASO, dicho como una condición.
 *
 * "Mostrar productos elegidos a mano" obliga a listar productos de a uno. Sirve para
 * una selección curada de cinco y no sirve para "las ofertas", "todo lo de pinturas" o
 * "lo que sale menos de 20.000" — que son las tres cosas que un recorrido real quiere
 * mostrar. Y además un recorrido con productos adentro envejece: se discontinúa uno y
 * el paso lo sigue ofreciendo, hasta que alguien se da cuenta.
 *
 * Con una condición, el paso se escribe una vez y el catálogo lo mantiene actualizado.
 *
 * Los campos que se ofrecen son los que el índice tiene facetados —categoría, precio,
 * promoción—; no hay un campo libre para escribir sintaxis de Typesense a propósito:
 * un error de sintaxis recién se vería con un cliente adelante.
 */

type Categoria = { id: string; name: string; parent_category_id?: string | null };

type Filtro = {
  categoryIds?: string[];
  priceMin?: number;
  priceMax?: number;
  onlyPromotions?: boolean;
  sort?: 'relevancia' | 'precio_asc' | 'precio_desc';
};

const numeroOVacio = (value: string): number | undefined => {
  const limpio = value.trim();
  if (limpio === '') return undefined;
  const n = Number(limpio);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function CatalogFilterField({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (filtro: Filtro) => void;
}): ReactElement {
  const filtro = value as Filtro;
  const [busqueda, setBusqueda] = useState('');

  const { data: categorias = [] } = useQuery({
    queryKey: ['whatsapp-flujos', 'categorias'],
    queryFn: async () => {
      const { product_categories } = await sdk.admin.productCategory.list({
        limit: 200,
        fields: 'id,name,parent_category_id',
      });
      return (product_categories ?? []) as Categoria[];
    },
  });

  const elegidas = filtro.categoryIds ?? [];
  const porId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const candidatas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return [];
    return categorias
      .filter((c) => !elegidas.includes(c.id) && c.name.toLowerCase().includes(texto))
      .slice(0, 8);
  }, [busqueda, categorias, elegidas]);

  const set = (patch: Filtro) => onChange({ ...filtro, ...patch });

  return (
    <div className="flex flex-col gap-y-3 rounded-md border p-3">
      {/* ── Categorías ── */}
      <div className="flex flex-col gap-y-1">
        <Text size="xsmall">Categorías</Text>
        {elegidas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {elegidas.map((id) => (
              <Badge key={id} size="2xsmall" className="flex items-center gap-x-1">
                {porId.get(id)?.name ?? id}
                <IconButton
                  size="2xsmall"
                  variant="transparent"
                  aria-label="Quitar"
                  onClick={() => set({ categoryIds: elegidas.filter((x) => x !== id) })}
                >
                  <Trash />
                </IconButton>
              </Badge>
            ))}
          </div>
        )}
        <Input
          size="small"
          placeholder="Buscar una categoría…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {candidatas.length > 0 && (
          <div className="flex flex-col gap-y-1">
            {candidatas.map((categoria) => (
              <button
                key={categoria.id}
                type="button"
                className="rounded-md p-1.5 text-left text-xs hover:bg-ui-bg-base-hover"
                onClick={() => {
                  set({ categoryIds: [...elegidas, categoria.id] });
                  setBusqueda('');
                }}
              >
                {categoria.name}
              </button>
            ))}
          </div>
        )}
        <Text size="xsmall" className="text-ui-fg-subtle">
          {/* Es la diferencia que más confunde: se filtra por el camino, no por la hoja. */}
          Incluye lo que cuelga de cada categoría, no sólo lo que está colgado
          directamente ahí.
        </Text>
      </div>

      {/* ── Precio ── */}
      <div className="flex flex-col gap-y-1">
        <Text size="xsmall">Precio</Text>
        <div className="flex items-center gap-x-2">
          <Input
            size="small"
            type="number"
            placeholder="desde"
            value={filtro.priceMin ?? ''}
            onChange={(e) => set({ priceMin: numeroOVacio(e.target.value) })}
          />
          <Input
            size="small"
            type="number"
            placeholder="hasta"
            value={filtro.priceMax ?? ''}
            onChange={(e) => set({ priceMax: numeroOVacio(e.target.value) })}
          />
        </div>
        <Text size="xsmall" className="text-ui-fg-subtle">
          Cualquiera de los dos se puede dejar vacío.
        </Text>
      </div>

      {/* ── Promociones ── */}
      <label className="flex items-start gap-x-2">
        {/* `shrink-0`: en un flex con el texto al lado se comprime hasta ser un punto. */}
        <Switch
          className="shrink-0"
          checked={filtro.onlyPromotions === true}
          onCheckedChange={(checked) => set({ onlyPromotions: checked ? true : undefined })}
        />
        <Text size="xsmall">Sólo lo que está en promoción</Text>
      </label>

      {/* ── Orden ── */}
      <label className="flex flex-col gap-y-1">
        <Text size="xsmall">Orden</Text>
        <Select
          value={filtro.sort ?? 'relevancia'}
          onValueChange={(sort) => set({ sort: sort as Filtro['sort'] })}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="relevancia">El orden del catálogo</Select.Item>
            <Select.Item value="precio_asc">Más barato primero</Select.Item>
            <Select.Item value="precio_desc">Más caro primero</Select.Item>
          </Select.Content>
        </Select>
      </label>

      {/* Un filtro vacío traería el catálogo entero, así que el paso no publica nada y
          es mejor decirlo acá que descubrirlo probando. */}
      {elegidas.length === 0 &&
        filtro.priceMin === undefined &&
        filtro.priceMax === undefined &&
        filtro.onlyPromotions !== true && (
          <Text size="xsmall" className="text-ui-fg-error">
            Sin ninguna condición el paso no muestra nada. Elegí al menos una categoría,
            un precio o las promociones.
          </Text>
        )}
    </div>
  );
}
