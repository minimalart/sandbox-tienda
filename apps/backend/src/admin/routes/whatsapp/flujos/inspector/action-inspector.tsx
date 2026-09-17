import { Input, Select, Switch, Text } from '@medusajs/ui';
import type { ReactElement } from 'react';

import { ACTIONS, argsOf } from '../_editor';
import { ProductPicker, SingleProductPicker } from '../_product-picker';
import { CatalogFilterField } from './catalog-filter-field';
import type { NodeInspectorProps } from './types';

/**
 * QUÉ HACE UNA ACCIÓN Y CON QUÉ.
 *
 * El nodo guardaba `args` desde el principio pero el inspector nunca los editó: sólo
 * dejaba elegir la tool. Así `wa_add_to_cart` no tenía cómo saber QUÉ agregar y
 * `wa_list_presentations` no tenía de qué producto listar — las dos quedaban
 * dibujables e inservibles.
 */
export function ActionInspector({ node, patch, patchArg }: NodeInspectorProps): ReactElement {
  const campos = argsOf(node.tool);

  return (
    <div className="flex flex-col gap-y-3">
      <label className="flex flex-col gap-y-1">
        <Text size="xsmall">Acción</Text>
        <Select value={node.tool ?? ''} onValueChange={(value) => patch({ tool: value })}>
          <Select.Trigger>
            <Select.Value placeholder="Elegí una acción" />
          </Select.Trigger>
          <Select.Content>
            {ACTIONS.map((action) => (
              <Select.Item key={action.value} value={action.value}>
                {action.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </label>

      {campos.map((field) => (
        <div key={field.name} className="flex flex-col gap-y-1">
          <Text size="xsmall">{field.label}</Text>
          {field.kind === 'products' ? (
            <ProductPicker
              value={Array.isArray(node.args?.[field.name]) ? (node.args?.[field.name] as string[]) : []}
              onChange={(ids) => patchArg(field.name, ids)}
            />
          ) : field.kind === 'product' ? (
            <SingleProductPicker
              value={typeof node.args?.[field.name] === 'string' ? (node.args?.[field.name] as string) : ''}
              onChange={(value) => patchArg(field.name, value)}
              help={field.help}
            />
          ) : field.kind === 'filter' ? (
            <CatalogFilterField
              value={(node.args?.[field.name] ?? {}) as Record<string, unknown>}
              onChange={(filtro) => patchArg(field.name, filtro)}
            />
          ) : (
            <Input
              size="small"
              placeholder={field.placeholder}
              value={typeof node.args?.[field.name] === 'string' ? (node.args?.[field.name] as string) : ''}
              onChange={(e) => patchArg(field.name, e.target.value)}
            />
          )}
          {field.help && field.kind !== 'product' && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              {field.help}
            </Text>
          )}
        </div>
      ))}

      {node.tool && campos.length === 0 && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Esta acción no necesita que le configures nada.
        </Text>
      )}

      {/**
        * `silent` ya lo leía el motor pero el editor no lo ofrecía, así que la única
        * forma de usarlo era cargar el grafo por API. Varias acciones cierran su
        * turno con botones propios —"¿Algo más o cerramos?"— que entiende el router y
        * no el recorrido: si el recorrido quiere seguir él, esos botones sobran y el
        * cliente veía dos preguntas seguidas para una sola decisión.
        */}
      <label className="flex items-start gap-x-2 border-t pt-3">
        {/* `shrink-0`: en un flex con el texto al lado, se comprime hasta ser un punto. */}
        <Switch
          className="shrink-0"
          checked={node.silent === true}
          onCheckedChange={(checked) => patch({ silent: checked ? true : undefined })}
        />
        <span>
          <Text size="xsmall" weight="plus">
            Seguir en el mismo mensaje
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            La acción no manda su propia pregunta de seguimiento: lo que sigue lo dibuja el
            recorrido. Sirve para “agregá al carrito y preguntá si quiere algo más” en un solo
            mensaje. No lo uses en una búsqueda: silenciaría el listado, que es el resultado mismo.
          </Text>
        </span>
      </label>
    </div>
  );
}
