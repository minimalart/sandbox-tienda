import { Alert, Badge, Button, Container, Heading, Text } from '@medusajs/ui';
import type { UnknownSiteCredential } from '../../../../hooks/api/site-credentials';
import { formatSavedAt } from './source-badge';

/**
 * Filas de `site_credential` que el catálogo no conoce.
 *
 * Son secretos vivos que nadie lee: quedaron de un INSERT a mano —el único modo de
 * cargar una credencial antes de que existiera la ruta de escritura—, de un rename
 * del provider, o de una extensión que se desinstaló. Se muestran a propósito: una
 * fila invisible con un secreto adentro es peor que una fila fea.
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * OJO, hoy NO se pueden borrar desde acá, y no es una omisión de la UI.
 *
 * `DELETE /admin/site-credentials` valida el query param contra
 * `DeleteSiteCredentialSchema`, que usa el enum del catálogo (`schemas.ts:95`). Una
 * integración desconocida —que es la definición exacta de estas filas— nunca pasa esa
 * validación: la ruta responde 400. El POST tampoco sirve de escape, porque su
 * `integration` usa el mismo enum.
 *
 * El botón queda visible y deshabilitado, con el motivo al lado: esconderlo haría
 * creer que estas filas están bien así, y cablearlo igual sería un botón que siempre
 * falla, que es la pantalla-que-miente que el resto de este módulo existe para evitar.
 *
 * Se destraba con un cambio chico en la ruta: aceptar `z.string().min(1)` en el
 * DELETE cuando la integración no está en el catálogo (el borrado en sí ya funciona,
 * `deleteSiteCredentialsViaSql` no mira el catálogo). Mientras tanto la salida es
 * marcar `deleted_at` en la fila por base.
 * ─────────────────────────────────────────────────────────────────────────────────
 */

type Props = { rows: UnknownSiteCredential[]; siteName: string };

export const UnknownIntegrations = ({ rows, siteName }: Props) => {
  if (rows.length === 0) return null;

  return (
    <Container className="divide-y divide-ui-border-base p-0">
      <div className="flex flex-col gap-y-1 px-6 py-4">
        <Heading level="h2">Credenciales sin integración conocida</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {siteName} tiene{' '}
          {rows.length === 1 ? 'una fila guardada' : `${rows.length} filas guardadas`} para
          integraciones que el catálogo no declara. Ningún lector las busca: son secretos vivos que
          no hacen nada.
        </Text>
      </div>

      <div className="px-6 py-4">
        <Alert variant="warning">
          <Text size="small">
            Todavía no se pueden borrar desde acá: la ruta de borrado sólo acepta integraciones del
            catálogo, así que un pedido con estos nombres responde 400. Hasta que la ruta acepte
            nombres libres hay que sacarlas por base, marcando{' '}
            <span className="font-mono">deleted_at</span> en{' '}
            <span className="font-mono">site_credential</span>.
          </Text>
        </Alert>
      </div>

      {rows.map((row) => (
        <div
          key={row.integration}
          className="flex flex-wrap items-center justify-between gap-2 px-6 py-3"
        >
          <div className="flex flex-col gap-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Text size="small" weight="plus" className="font-mono">
                {row.integration}
              </Text>
              {!row.decryptable && (
                <Badge size="2xsmall" color="red">
                  no se puede descifrar
                </Badge>
              )}
              {formatSavedAt(row.updated_at) && (
                <Text size="xsmall" className="text-ui-fg-muted">
                  Guardado el {formatSavedAt(row.updated_at)}
                </Text>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {row.set_keys.length > 0 ? (
                row.set_keys.map((key) => (
                  <Badge key={key} size="2xsmall" className="font-mono">
                    {key}
                  </Badge>
                ))
              ) : (
                <Text size="xsmall" className="text-ui-fg-muted">
                  {row.decryptable
                    ? 'Sin claves adentro.'
                    : 'No se puede listar qué claves tiene: el blob no descifra.'}
                </Text>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-2">
            <Text size="xsmall" className="text-ui-fg-muted">
              El borrado por pantalla todavía no está habilitado para esta fila.
            </Text>
            <Button variant="danger" size="small" disabled>
              Borrar
            </Button>
          </div>
        </div>
      ))}
    </Container>
  );
};
