import { Alert, Badge, Text } from '@medusajs/ui';
import type { SiteCredentialIntegration } from '../../../../hooks/api/site-credentials';

/**
 * Integración del catálogo que TODAVÍA no lee de `site_credential`.
 *
 * No se ofrece guardar, y no es una limitación de la UI: el POST la rechaza. Una
 * pantalla que acepta un secreto que nadie consume miente dos veces —el operador ve
 * "cargada" y el checkout sigue cobrando en la cuenta global— y esa media migración
 * es exactamente lo que el registro de rutas existe para evitar. Se muestra igual
 * porque el mapa completo es lo que hace falta para planificar el fail-closed.
 */
export const BlockedBody = ({
  integration,
  error,
}: {
  integration: SiteCredentialIntegration;
  error: string | null;
}) => (
  <div className="flex flex-col gap-y-3 px-6 py-4">
    <Alert variant="warning">
      <div className="flex flex-col gap-y-2">
        <Text size="small" weight="plus">
          Todavía no se puede configurar por tienda.
        </Text>
        <Text size="small">
          Nada lee las credenciales de {integration.label} desde la base: hoy salen del entorno y
          son las mismas para todas las tiendas. Guardarlas acá no cambiaría nada, así que la
          pantalla no lo ofrece.
        </Text>
        {integration.blocked_reason && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {integration.blocked_reason}
          </Text>
        )}
      </div>
    </Alert>

    {integration.is_set && (
      <div className="flex flex-col gap-y-2 rounded-md border border-ui-border-base px-3 py-2">
        <Text size="xsmall" className="text-ui-fg-subtle">
          Ojo: esta tienda TIENE una fila guardada para esta integración, cargada antes de que
          existiera esta pantalla. Nadie la lee. Sacala con "Desconectar cuenta propia" así no
          queda un secreto vivo que nada consume.
        </Text>
        <div className="flex flex-wrap items-center gap-1">
          {integration.set_keys.map((key) => (
            <Badge key={key} size="2xsmall" className="font-mono">
              {key}
            </Badge>
          ))}
          {!integration.decryptable && (
            <Badge size="2xsmall" color="red">
              no se puede descifrar
            </Badge>
          )}
        </div>
      </div>
    )}

    {error && (
      <Text size="small" className="text-ui-fg-error" role="alert">
        {error}
      </Text>
    )}
  </div>
);
