import { Input, Select, Text } from '@medusajs/ui';
import type { ReactElement } from 'react';

import type { EditorCondition } from '../_editor';

/**
 * El formulario de una condición: qué mirar, con qué comparar y contra qué.
 *
 * Estaba escrito DOS VECES en `page.tsx` —una para la rama de una bifurcación y otra
 * para la condición de una flecha— con los mismos cuatro operadores copiados. Dos
 * copias de una lista de operadores es una que se olvida de actualizar.
 *
 * Un `path` vacío BORRA la condición en vez de guardarla a medias: sin path no dice
 * qué mirar, y guardada así la rama no matchea nunca y el operador se vuelve loco
 * buscando por qué.
 */
export function ConditionEditor({
  value,
  onChange,
  placeholder = 'vars.cart_units',
}: {
  value: EditorCondition | undefined;
  onChange: (next: EditorCondition | undefined) => void;
  placeholder?: string;
}): ReactElement {
  const op = value?.op ?? 'exists';

  return (
    <div className="flex flex-col gap-y-1">
      <div className="flex items-center gap-x-1">
        <Input
          size="small"
          placeholder={placeholder}
          value={value?.path ?? ''}
          onChange={(e) =>
            onChange(
              e.target.value
                ? { path: e.target.value, op, ...(value?.value !== undefined ? { value: value.value } : {}) }
                : undefined,
            )
          }
        />
        <Select
          value={op}
          onValueChange={(next) =>
            onChange({
              path: value?.path ?? '',
              op: next as EditorCondition['op'],
              ...(value?.value !== undefined ? { value: value.value } : {}),
            })
          }
        >
          <Select.Trigger className="w-32">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="exists">tiene valor</Select.Item>
            <Select.Item value="empty">está vacío</Select.Item>
            <Select.Item value="eq">es igual a</Select.Item>
            <Select.Item value="ne">es distinto de</Select.Item>
          </Select.Content>
        </Select>
      </div>

      {(op === 'eq' || op === 'ne') && (
        <Input
          size="small"
          placeholder="valor"
          value={String(value?.value ?? '')}
          onChange={(e) => onChange({ path: value?.path ?? '', op, value: e.target.value })}
        />
      )}

      {!value && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Sin condición es la salida por default: se toma cuando no se cumple ninguna otra.
        </Text>
      )}
    </div>
  );
}
