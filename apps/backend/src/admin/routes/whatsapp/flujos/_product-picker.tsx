import { ArrowDownMini, ArrowUpMini, Trash, XMarkMini } from '@medusajs/icons';
import { Button, IconButton, Input, Switch, Text } from '@medusajs/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactElement } from 'react';

import { sdk } from '../../../lib/client';

/**
 * ELEGIR PRODUCTOS PARA UN PASO DEL RECORRIDO, viéndolos.
 *
 * El buscador ya existía pero mostraba SÓLO EL TÍTULO: pedía `thumbnail` al servidor y
 * no lo dibujaba. En un catálogo con "Látex interior 20L" y "Látex interior 20L
 * mate", el título no alcanza para saber cuál es cuál, y el operador está eligiendo lo
 * que va a ver un cliente en WhatsApp. Ahora se ve la foto en la búsqueda y en lo
 * elegido, como el selector de los videos comprables.
 *
 * Los otros dos buscadores del admin siguen sin poder reusarse: el del blog habla por
 * un namespace i18n que en este árbol no registra nadie —los textos saldrían como
 * "PRODUCTS_SEARCH"— y el de Curations lo posee la extensión typesense, así que
 * importarlo ataría el editor a que esa extensión esté instalada.
 */

const FIELDS = 'id,title,thumbnail,variants.id,variants.title';

type VarianteLite = { id: string; title?: string | null };
type ProductoLite = { id: string; title: string; thumbnail?: string | null; variants?: VarianteLite[] };

/** La miniatura, con un hueco del mismo tamaño cuando el producto no tiene foto. */
function Thumb({ src, alt }: { src?: string | null; alt?: string }): ReactElement {
  if (!src) return <div className="h-9 w-9 shrink-0 rounded-md bg-ui-bg-component" />;
  return <img src={src} alt={alt ?? ''} className="h-9 w-9 shrink-0 rounded-md object-cover" />;
}

/** Busca productos en el catálogo, con un respiro para no consultar en cada tecla. */
function useBusqueda(texto: string, habilitado = true) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQuery(texto.trim()), 300);
    return () => clearTimeout(id);
  }, [texto]);

  return useQuery({
    queryKey: ['whatsapp-flujos', 'productos', query],
    queryFn: async () => {
      const { products } = await sdk.admin.product.list({ q: query, limit: 8, fields: FIELDS });
      return (products ?? []) as ProductoLite[];
    },
    enabled: habilitado && query.length > 1,
  });
}

/** Trae los productos ya elegidos, para poder mostrarlos con su foto. */
function useProductosPorId(ids: readonly string[]) {
  return useQuery({
    queryKey: ['whatsapp-flujos', 'productos-por-id', [...ids].sort().join(',')],
    queryFn: async () => {
      const { products } = await sdk.admin.product.list({
        id: [...ids],
        limit: ids.length,
        fields: FIELDS,
      });
      return (products ?? []) as ProductoLite[];
    },
    enabled: ids.length > 0,
  });
}

// ─── Varios productos, en orden ───────────────────────────────────────────────

/**
 * EL ORDEN ES DATO, no presentación: es el orden en que el cliente ve las opciones en
 * WhatsApp. Se mueve con flechas y no arrastrando a propósito: son tres o cuatro
 * items y arrastrar dentro de un panel que ya scrollea pelea con el canvas.
 */
export function ProductPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}): ReactElement {
  const [texto, setTexto] = useState('');
  const { data: resultados = [], isFetching } = useBusqueda(texto);
  const { data: elegidos = [] } = useProductosPorId(value);

  const porId = useMemo(
    () => new Map([...elegidos, ...resultados].map((p) => [p.id, p])),
    [elegidos, resultados],
  );

  const mover = (desde: number, hacia: number) => {
    if (hacia < 0 || hacia >= value.length) return;
    const next = [...value];
    const [item] = next.splice(desde, 1);
    next.splice(hacia, 0, item as string);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-y-2">
      {value.map((id, index) => (
        <div key={id} className="flex items-center gap-x-2 rounded-md border p-2">
          <Text size="xsmall" className="w-4 shrink-0 text-ui-fg-muted">
            {index + 1}
          </Text>
          <Thumb src={porId.get(id)?.thumbnail} alt={porId.get(id)?.title} />
          <Text size="xsmall" className="min-w-0 flex-1 truncate">
            {porId.get(id)?.title ?? id}
          </Text>
          <IconButton size="small" variant="transparent" aria-label="Subir" onClick={() => mover(index, index - 1)}>
            <ArrowUpMini />
          </IconButton>
          <IconButton size="small" variant="transparent" aria-label="Bajar" onClick={() => mover(index, index + 1)}>
            <ArrowDownMini />
          </IconButton>
          <IconButton
            size="small"
            variant="transparent"
            aria-label="Quitar"
            onClick={() => onChange(value.filter((x) => x !== id))}
          >
            <Trash />
          </IconButton>
        </div>
      ))}

      <Input
        size="small"
        placeholder="Buscar un producto…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />

      {texto.trim().length > 1 && (
        <Resultados
          productos={resultados.filter((p) => !value.includes(p.id))}
          cargando={isFetching}
          onPick={(producto) => {
            onChange([...value, producto.id]);
            setTexto('');
          }}
        />
      )}
    </div>
  );
}

// ─── Un producto, o lo que eligió el cliente ──────────────────────────────────

/** `{{text}}`, `{{vars.x}}`, `{{answers.x}}`: lo que resuelve el motor en vivo. */
const esPlantilla = (value: string): boolean => /^\{\{.+\}\}$/.test(value.trim());

/** Lo que pone el editor cuando el paso tiene que usar lo que el cliente eligió. */
export const SELECCION_DEL_CLIENTE = '{{vars.selected_variant}}';

/**
 * QUÉ PRODUCTO USA ESTE PASO.
 *
 * Antes era un campo de texto donde había que escribir a mano el id de una variante —
 * un dato que el operador no tiene a mano y no puede verificar— o acordarse de la
 * plantilla exacta `{{vars.selected_variant}}`. Las dos cosas se equivocan fácil y el
 * error recién aparece con un cliente adelante.
 *
 * Ahora son dos modos explícitos: el producto que el cliente acaba de elegir, o uno
 * fijo buscado en el catálogo y elegido por su foto. El valor que se guarda es el
 * mismo string de siempre, así que el motor no cambia.
 */
export function VariantPicker({
  value,
  onChange,
  help,
}: {
  value: string;
  onChange: (value: string) => void;
  help?: string;
}): ReactElement {
  const dinamico = value.trim() === '' || esPlantilla(value);
  const [texto, setTexto] = useState('');
  const { data: resultados = [], isFetching } = useBusqueda(texto, !dinamico);

  return (
    <div className="flex flex-col gap-y-2">
      <label className="flex items-start gap-x-2">
        {/* `shrink-0`: en un flex con el texto al lado se comprime hasta ser un punto. */}
        <Switch
          className="shrink-0"
          checked={dinamico}
          onCheckedChange={(checked) => onChange(checked ? SELECCION_DEL_CLIENTE : '')}
        />
        <span>
          <Text size="xsmall" weight="plus">
            Usar el producto que eligió el cliente
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Es lo normal después de mostrarle una lista o un carrusel. Apagalo para fijar uno.
          </Text>
        </span>
      </label>

      {dinamico ? (
        <Input
          size="small"
          placeholder={SELECCION_DEL_CLIENTE}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <ElegidoOBuscador
          value={value}
          onChange={onChange}
          texto={texto}
          setTexto={setTexto}
          resultados={resultados}
          cargando={isFetching}
        />
      )}

      {help && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {help}
        </Text>
      )}
    </div>
  );
}

function ElegidoOBuscador({
  value,
  onChange,
  texto,
  setTexto,
  resultados,
  cargando,
}: {
  value: string;
  onChange: (value: string) => void;
  texto: string;
  setTexto: (value: string) => void;
  resultados: ProductoLite[];
  cargando: boolean;
}): ReactElement {
  /**
   * Lo elegido se guarda como id de VARIANTE, que es lo que piden las acciones. Para
   * poder mostrarlo con su foto hay que encontrar el producto que la contiene, y la
   * API de admin no busca por id de variante: se busca por texto y se mira adentro.
   * Mientras no se encuentre, se muestra el id — que es exactamente lo que se veía
   * antes, así que no se pierde nada.
   */
  const { data: candidatos = [] } = useQuery({
    queryKey: ['whatsapp-flujos', 'variante', value],
    queryFn: async () => {
      const { products } = await sdk.admin.product.list({ limit: 100, fields: FIELDS });
      return (products ?? []) as ProductoLite[];
    },
    enabled: value.trim().length > 0,
  });

  const elegido = useMemo(() => {
    for (const producto of candidatos) {
      const variante = (producto.variants ?? []).find((v) => v.id === value);
      if (variante) return { producto, variante };
    }
    return null;
  }, [candidatos, value]);

  if (value.trim()) {
    return (
      <div className="flex items-center gap-x-2 rounded-md border p-2">
        <Thumb src={elegido?.producto.thumbnail} alt={elegido?.producto.title} />
        <span className="min-w-0 flex-1">
          <Text size="xsmall" className="truncate">
            {elegido?.producto.title ?? value}
          </Text>
          {elegido?.variante.title && (
            <Text size="xsmall" className="truncate text-ui-fg-subtle">
              {elegido.variante.title}
            </Text>
          )}
        </span>
        <IconButton size="small" variant="transparent" aria-label="Cambiar" onClick={() => onChange('')}>
          <XMarkMini />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-2">
      <Input
        size="small"
        placeholder="Buscar un producto…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      {texto.trim().length > 1 && (
        <Resultados
          productos={resultados}
          cargando={cargando}
          // Una acción de producto pide una VARIANTE: si el producto tiene una sola se
          // toma sin preguntar, y si tiene varias se muestran para elegir cuál.
          expandirVariantes
          onPickVariant={(variantId) => {
            onChange(variantId);
            setTexto('');
          }}
        />
      )}
    </div>
  );
}

// ─── Resultados ───────────────────────────────────────────────────────────────

function Resultados({
  productos,
  cargando,
  onPick,
  onPickVariant,
  expandirVariantes = false,
}: {
  productos: ProductoLite[];
  cargando: boolean;
  onPick?: (producto: ProductoLite) => void;
  onPickVariant?: (variantId: string) => void;
  expandirVariantes?: boolean;
}): ReactElement {
  if (cargando && productos.length === 0) {
    return (
      <Text size="xsmall" className="text-ui-fg-subtle">
        Buscando…
      </Text>
    );
  }

  if (productos.length === 0) {
    return (
      <Text size="xsmall" className="text-ui-fg-subtle">
        No encontré productos con ese nombre.
      </Text>
    );
  }

  return (
    <div className="flex max-h-64 flex-col gap-y-1 overflow-y-auto">
      {productos.map((producto) => {
        const variantes = producto.variants ?? [];
        const unaSola = expandirVariantes && variantes.length === 1;

        return (
          <div key={producto.id} className="flex flex-col gap-y-1">
            <button
              type="button"
              className="flex items-center gap-x-2 rounded-md p-2 text-left hover:bg-ui-bg-base-hover"
              disabled={expandirVariantes && variantes.length > 1}
              onClick={() => {
                if (!expandirVariantes) onPick?.(producto);
                else if (unaSola) onPickVariant?.(variantes[0]?.id as string);
              }}
            >
              <Thumb src={producto.thumbnail} alt={producto.title} />
              <Text size="xsmall" className="min-w-0 flex-1 truncate">
                {producto.title}
              </Text>
            </button>

            {expandirVariantes && variantes.length > 1 && (
              <div className="flex flex-wrap gap-1 pl-12">
                {variantes.map((variante) => (
                  <Button
                    key={variante.id}
                    size="small"
                    variant="secondary"
                    onClick={() => onPickVariant?.(variante.id)}
                  >
                    {variante.title ?? variante.id}
                  </Button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
