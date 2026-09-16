import { Drawer, Text } from '@medusajs/ui';
import type { ReactElement } from 'react';

import { FlowSettings } from '../inspector/flow-inspector';
import { flowLevelIssues, type EditorIssue, type IssueTarget } from '../lib/issues';

/**
 * LA CONFIGURACIÓN Y LOS PROBLEMAS, cada uno en su cajón.
 *
 * Los dos vivían en la columna fija de la derecha, siempre a la vista: la
 * configuración se toca una vez cada mucho y los problemas sólo importan cuando hay.
 * El canvas se queda con el ancho, y estos aparecen cuando alguien los pide.
 */

export function SettingsDrawer({
  open,
  onOpenChange,
  siteId,
  activeVersion,
  publishedAt,
  exclusive,
  onExclusiveChange,
  notes,
  onNotesChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string | null;
  activeVersion: number | null;
  publishedAt: string | null;
  exclusive: boolean;
  onExclusiveChange: (value: boolean) => void;
  notes: string;
  onNotesChange: (value: string) => void;
}): ReactElement {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Configuración del recorrido</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto">
          <FlowSettings
            siteId={siteId}
            activeVersion={activeVersion}
            publishedAt={publishedAt}
            exclusive={exclusive}
            onExclusiveChange={onExclusiveChange}
            notes={notes}
            onNotesChange={onNotesChange}
          />
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
}

/**
 * La lista de problemas, con cada uno clickeable para ir a mirarlo.
 *
 * Se abre desde el badge del header. Antes ese badge saltaba a ciegas al problema
 * siguiente: servía para recorrerlos de a uno, pero no para ver cuántos hay ni de qué
 * son — que es lo que uno quiere saber antes de decidir si publica.
 */
export function IssuesDrawer({
  open,
  onOpenChange,
  issues,
  onGoTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: readonly EditorIssue[];
  onGoTo: (target: IssueTarget) => void;
}): ReactElement {
  const bloqueantes = issues.filter((i) => i.severity === 'blocking');
  const avisos = issues.filter((i) => i.severity === 'warning');
  const sueltos = flowLevelIssues(issues);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Problemas del recorrido</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          {issues.length === 0 && (
            <Text size="small" className="text-ui-fg-subtle">
              No hay ninguno. El recorrido se puede publicar.
            </Text>
          )}

          {bloqueantes.length > 0 && (
            <div className="flex flex-col gap-y-2">
              <Text size="xsmall" weight="plus">
                Impiden publicar
              </Text>
              {bloqueantes.map((issue, i) => (
                <IssueRow key={`b${i}`} issue={issue} onGoTo={onGoTo} onOpenChange={onOpenChange} tone="error" />
              ))}
            </div>
          )}

          {avisos.length > 0 && (
            <div className="flex flex-col gap-y-2">
              <Text size="xsmall" weight="plus">
                Conviene revisar
              </Text>
              {/* Estos el servidor no los ve: una respuesta sin texto le llega ya
                  "arreglada" con el id interno, así que publica igual y el cliente
                  termina viendo un botón que dice `opcion_2`. */}
              {avisos.map((issue, i) => (
                <IssueRow key={`w${i}`} issue={issue} onGoTo={onGoTo} onOpenChange={onOpenChange} tone="muted" />
              ))}
            </div>
          )}

          {sueltos.length > 0 && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Los que no nombran un paso son del recorrido entero y no se pueden señalar en el
              canvas.
            </Text>
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
}

function IssueRow({
  issue,
  onGoTo,
  onOpenChange,
  tone,
}: {
  issue: EditorIssue;
  onGoTo: (target: IssueTarget) => void;
  onOpenChange: (open: boolean) => void;
  tone: 'error' | 'muted';
}): ReactElement {
  const target: IssueTarget | null = issue.nodeId
    ? { kind: 'node', id: issue.nodeId }
    : issue.edgeId
      ? { kind: 'edge', id: issue.edgeId }
      : null;
  const className = tone === 'error' ? 'text-ui-fg-error' : 'text-ui-fg-subtle';

  if (!target) {
    return (
      <Text size="xsmall" className={className}>
        {issue.message}
      </Text>
    );
  }

  return (
    <button
      type="button"
      className="rounded-md border p-2 text-left hover:bg-ui-bg-base-hover"
      onClick={() => {
        // Se cierra al ir: el paso queda detrás del cajón y el punto es mirarlo.
        onOpenChange(false);
        onGoTo(target);
      }}
    >
      <Text size="xsmall" className={className}>
        {issue.message}
      </Text>
      <Text size="xsmall" className="text-ui-fg-muted">
        Ir al paso
      </Text>
    </button>
  );
}
