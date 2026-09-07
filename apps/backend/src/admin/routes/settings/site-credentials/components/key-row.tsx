import { Badge, Button, Input, Label, Text } from '@medusajs/ui';
import type { SiteCredentialKeySpec } from '../../../../hooks/api/site-credentials';

/**
 * UNA clave de UNA integración: nombre, si está cargada, y el affordance de tres
 * botones (Reemplazar / Borrar / Deshacer) que reemplaza al input pre-poblado.
 *
 * Por qué no hay input pre-poblado: ver el docblock de `integration-card.tsx`. Acá
 * sólo importa que las cuatro variantes (marcada para borrar / guardada quieta /
 * reemplazando / vacía) son mutuamente excluyentes y el componente entero es una
 * función pura del estado que le pasan — nada de estado propio, para que el padre
 * pueda descartar todo con un `reset()`.
 */

export type KeyRowProps = {
  inputId: string;
  spec: SiteCredentialKeySpec;
  stored: boolean;
  value: string | undefined;
  marked: boolean;
  replacing: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onStartReplace: () => void;
  onCancelReplace: () => void;
  onToggleDelete: () => void;
};

export const KeyRow = ({
  inputId,
  spec,
  stored,
  value,
  marked,
  replacing,
  disabled,
  onChange,
  onStartReplace,
  onCancelReplace,
  onToggleDelete,
}: KeyRowProps) => {
  const touched = (value ?? '').trim() !== '' || marked;
  const helpId = spec.help ? `${inputId}-help` : undefined;

  return (
    <div className="flex flex-col gap-y-1.5 py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Label size="small" weight="plus" htmlFor={inputId}>
          {spec.label}
        </Label>
        <Badge size="2xsmall" className="font-mono">
          {spec.key}
        </Badge>
        {stored ? (
          <Badge size="2xsmall" color="green">
            Cargada
          </Badge>
        ) : (
          <Badge size="2xsmall" color="grey">
            Sin cargar
          </Badge>
        )}
      </div>

      {marked ? (
        <div className="flex flex-wrap items-center gap-3">
          <Text size="small" className="text-ui-fg-error" aria-live="polite">
            Se borrará al guardar.
          </Text>
          <Button variant="secondary" size="small" disabled={disabled} onClick={onToggleDelete}>
            Deshacer
          </Button>
        </div>
      ) : stored && !replacing ? (
        <div className="flex flex-wrap items-center gap-3">
          {/* El valor no baja del servidor. Nunca. Ni enmascarado. */}
          <Text size="small" className="text-ui-fg-subtle">
            Guardada. El valor no se muestra.
          </Text>
          <div className="ml-auto flex items-center gap-x-2">
            <Button variant="secondary" size="small" disabled={disabled} onClick={onStartReplace}>
              Reemplazar
            </Button>
            <Button variant="danger" size="small" disabled={disabled} onClick={onToggleDelete}>
              Borrar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-x-2">
          <Input
            id={inputId}
            type={spec.secret ? 'password' : 'text'}
            autoComplete={spec.secret ? 'new-password' : 'off'}
            placeholder={spec.secret ? 'Pegá el valor nuevo' : 'Escribí el valor'}
            value={value ?? ''}
            disabled={disabled}
            aria-describedby={helpId}
            onChange={(event) => onChange(event.target.value)}
          />
          {stored && (
            <Button variant="secondary" size="small" disabled={disabled} onClick={onCancelReplace}>
              Cancelar
            </Button>
          )}
        </div>
      )}

      {spec.help && (
        <Text id={helpId} size="xsmall" className="text-ui-fg-subtle">
          {spec.help}
        </Text>
      )}
      {touched && (
        <Text size="xsmall" className="text-ui-fg-muted" aria-live="polite">
          Sin guardar
        </Text>
      )}
    </div>
  );
};
