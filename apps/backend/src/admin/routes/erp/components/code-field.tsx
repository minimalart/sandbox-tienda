import { Input, Select, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import type { ErpConfigLookupOption } from '../../../hooks/api';

/**
 * Un campo de la config que guarda un CÓDIGO del ERP.
 *
 * Los seis campos de código de Zeus (`sucursal`, `deposito_id`, `cond_venta`,
 * `codigo_de_vendedor`, `default_codigo_iva`, `tarjeta_code`) eran un `<Input>`
 * de texto libre, y el endpoint que lista los valores válidos existía desde el
 * principio sin que ninguna pantalla lo llamara.
 *
 * El costo real: en desdeelsur `cond_venta` quedó en `"Contado"`, que es el
 * NOMBRE y no el código. Zeus no lo valida y el pedido no entra. Y el campo
 * empujaba al error activamente — tenía `placeholder="CONTADO"` debajo de una
 * etiqueta que dice "Código de condición de venta". El código correcto es `01`,
 * y el ERP lo sabía listar todo este tiempo.
 *
 * Degrada a texto libre a propósito, y eso NO es un detalle: los listados de
 * Zeus fallan de a uno (un 401, una cuenta que no usa vendedores), y un select
 * vacío que no deja escribir es peor que el input que había — bloquearía una
 * configuración que hoy se puede completar a mano. Con opciones se elige; sin
 * opciones se escribe, y se dice por qué.
 */
export function ErpCodeField({
  label,
  value,
  onChange,
  options,
  /** Mensaje del listado, si falló. */
  error,
  /** Filas que llegaron y no se pudieron leer: es un bug nuestro, no del cliente. */
  unreadable,
  help,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ErpConfigLookupOption[] | undefined;
  error?: string;
  unreadable?: boolean;
  help?: string;
  numeric?: boolean;
}): JSX.Element {
  const { t } = useTranslation('erp');
  const hasOptions = Boolean(options?.length);

  /**
   * El Select de `@medusajs/ui` no representa "sin valor" con `""`, así que
   * "ninguno" necesita un valor propio. Hace falta de verdad: todos estos
   * campos son opcionales y tiene que poder VACIARSE uno ya guardado.
   */
  const NONE = '__none__';

  return (
    <div className="flex flex-col gap-1">
      <Text size="xsmall" className="text-ui-fg-subtle">
        {label}
      </Text>

      {hasOptions ? (
        <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? '' : next)}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={NONE}>{t('CODE_FIELD_NONE')}</Select.Item>
            {options?.map((option) => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      ) : (
        <Input
          type={numeric ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // Sin placeholder a propósito. El que había ("CONTADO") es el nombre
          // de la condición de venta, no su código, y un ejemplo equivocado
          // debajo de una etiqueta que dice "código" es peor que ninguno: es lo
          // que se copió tal cual en producción.
        />
      )}

      {help ? (
        <Text size="xsmall" className="text-ui-fg-muted">
          {help}
        </Text>
      ) : null}

      {/* Un listado que no se pudo leer no es culpa del operador ni algo que
          pueda resolver escribiendo mejor: se le dice que escriba el código a
          mano y que esto es un problema a reportar. */}
      {!hasOptions && unreadable ? (
        <Text size="xsmall" className="text-ui-fg-error">
          {t('CODE_FIELD_UNREADABLE')}
        </Text>
      ) : null}

      {!hasOptions && error ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {t('CODE_FIELD_ERROR', { msg: error })}
        </Text>
      ) : null}
    </div>
  );
}
