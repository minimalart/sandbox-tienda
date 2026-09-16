import { Badge, Button, Drawer, Text } from '@medusajs/ui';
import type { ReactElement } from 'react';

import type { FlowVersionSummary } from '../../../../hooks/api/whatsapp-flows';

/**
 * EL HISTORIAL DE VERSIONES.
 *
 * Las versiones supersedidas se guardan desde el principio —publicar no borra la
 * anterior, la marca— pero no había forma de mirarlas ni de traerlas de vuelta:
 * volver atrás significaba redibujar a mano el recorrido que ya existía en la base.
 *
 * Restaurar NO publica. Deja la versión cargada en el borrador para que alguien la
 * mire antes: volver atrás suele ser una urgencia, y una urgencia es justo cuando más
 * caro sale publicar algo sin leerlo.
 */

const ESTADO: Record<string, { text: string; color: 'green' | 'orange' | 'grey' }> = {
  active: { text: 'Atendiendo ahora', color: 'green' },
  draft: { text: 'Borrador', color: 'orange' },
  ready: { text: 'Lista', color: 'grey' },
  superseded: { text: 'Reemplazada', color: 'grey' },
};

export function VersionsDrawer({
  open,
  onOpenChange,
  versions,
  onRestore,
  restoring,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: readonly FlowVersionSummary[];
  onRestore: (id: string) => void;
  restoring: boolean;
}): ReactElement {
  /**
   * Restaurar ya no pregunta nada porque ya no pisa nada: copia esa versión a un
   * recorrido NUEVO y lleva ahí. Lo que se estaba armando queda donde estaba, y las
   * dos se pueden comparar antes de decidir cuál se publica.
   */
  const pedirRestaurar = (version: FlowVersionSummary) => onRestore(version.id);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Versiones del recorrido</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-3 overflow-y-auto">
            {versions.length === 0 && (
              <Text size="small" className="text-ui-fg-subtle">
                Todavía no se publicó ninguna versión.
              </Text>
            )}

            {versions.map((version) => {
              const estado = ESTADO[version.status] ?? { text: version.status, color: 'grey' as const };
              return (
                <div key={version.id} className="flex flex-col gap-y-1 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-x-2">
                    <div className="flex items-center gap-x-2">
                      <Text size="small" weight="plus">
                        Versión {version.version}
                      </Text>
                      <Badge size="2xsmall" color={estado.color}>
                        {estado.text}
                      </Badge>
                    </div>
                    {version.status !== 'draft' && (
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={restoring}
                        onClick={() => pedirRestaurar(version)}
                      >
                        Restaurar
                      </Button>
                    )}
                  </div>

                  {version.notes && (
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {version.notes}
                    </Text>
                  )}

                  <Text size="xsmall" className="text-ui-fg-muted">
                    {version.published_at
                      ? `Publicada el ${new Date(version.published_at).toLocaleString()}`
                      : `Editada el ${new Date(version.updated_at).toLocaleString()}`}
                  </Text>
                </div>
              );
            })}

            <Text size="xsmall" className="text-ui-fg-subtle">
              Restaurar carga esa versión en el borrador y no publica nada: el bot sigue atendiendo
              con la que está activa hasta que aprietes Publicar.
            </Text>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>

    </>
  );
}
