import { Drawer, Text } from '@medusajs/ui';
import { useMemo, type ReactElement } from 'react';

import type { FlowEditorState } from '../_use-flow-editor';
import {
  addBranch as addBranchTo,
  addOption as addOptionTo,
  branchesOf,
  outgoingProblems,
  patchArg,
  patchBranch,
  patchEdge,
  patchNode,
  patchOption,
  removeBranch,
  removeOption,
  TYPE_LABEL,
  type EditorCondition,
  type GraphEdge,
  type GraphNode,
} from '../_editor';
import { EdgeInspector } from '../inspector/edge-inspector';
import { NodeInspector } from '../inspector/node-inspector';
import { issuesByEdge, issuesByNode } from '../lib/issues';

/**
 * EL INSPECTOR, EN UN DRAWER QUE SE ABRE AL ELEGIR UN PASO.
 *
 * Era una columna fija que ocupaba un cuarto de la pantalla y que, sin nada
 * seleccionado, mostraba configuración que se toca una vez cada mucho. Ahora el canvas
 * usa todo el ancho y el panel aparece cuando hace falta.
 *
 * `modal={false}` y el clic afuera NO lo cierran: mientras se edita un paso hay que
 * poder ver el paso. Se cierra al deseleccionar —clic en el fondo, Escape— o con la X,
 * y elegir otro paso cambia el contenido en vez de cerrarlo y volverlo a abrir.
 */
export function Inspector({ editor }: { editor: FlowEditorState }): ReactElement {
  const { graph, mutate } = editor;

  const node = useMemo(
    () => graph.nodes.find((n) => n.id === editor.selectedNodeId) ?? null,
    [graph.nodes, editor.selectedNodeId],
  );
  const edge = useMemo(
    () => graph.edges.find((e) => e.id === editor.selectedEdgeId) ?? null,
    [graph.edges, editor.selectedEdgeId],
  );

  const porNodo = useMemo(() => issuesByNode(editor.issues), [editor.issues]);
  const porArista = useMemo(() => issuesByEdge(editor.issues), [editor.issues]);

  const abierto = Boolean(node || edge);
  const cerrar = () => {
    editor.setSelectedIds([]);
    editor.setSelectedEdgeId(null);
  };

  return (
    <Drawer open={abierto} onOpenChange={(open) => !open && cerrar()} modal={false}>
      <Drawer.Content
        overlayProps={{ style: { background: 'transparent', pointerEvents: 'none' } }}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <Drawer.Header>
          <Drawer.Title>
            {node ? TYPE_LABEL[node.type] : edge ? 'Conexión' : ''}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto">
          {node && <NodeBody editor={editor} node={node} problems={problemasDe(porNodo, graph, node)} />}
          {!node && edge && (
            <EdgeInspector
              edge={edge}
              source={graph.nodes.find((n) => n.id === edge.source) ?? null}
              target={graph.nodes.find((n) => n.id === edge.target) ?? null}
              problems={(porArista.get(edge.id) ?? []).map((i) => i.message)}
              patch={(patch: Partial<GraphEdge>) => mutate((g) => patchEdge(g, edge.id, patch))}
              onRemove={() => editor.requestDeleteEdge(edge.id)}
            />
          )}
          {!node && !edge && (
            <Text size="small" className="text-ui-fg-subtle">
              Tocá un paso o una conexión para editarlo.
            </Text>
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
}

/** Los avisos del paso: los del validador más los inmediatos de sus salidas. */
const problemasDe = (
  porNodo: Map<string, Array<{ message: string }>>,
  graph: FlowEditorState['graph'],
  node: GraphNode,
): string[] => [
  ...new Set([
    ...(porNodo.get(node.id) ?? []).map((i) => i.message),
    ...outgoingProblems(graph, node.id),
  ]),
];

function NodeBody({
  editor,
  node,
  problems,
}: {
  editor: FlowEditorState;
  node: GraphNode;
  problems: string[];
}): ReactElement {
  const { mutate } = editor;
  const id = node.id;

  return (
    <NodeInspector
      node={node}
      problems={problems}
      branches={branchesOf(node)}
      patch={(patch: Partial<GraphNode>) => mutate((g) => patchNode(g, id, patch))}
      patchArg={(name, value) => mutate((g) => patchArg(g, id, name, value))}
      addOption={() => mutate((g) => addOptionTo(g, id))}
      patchOption={(value, patch) => mutate((g) => patchOption(g, id, value, patch))}
      removeOption={(value) => mutate((g) => removeOption(g, id, value))}
      addBranch={() => mutate((g) => addBranchTo(g, id))}
      patchBranch={(value, patch: Partial<{ label: string; when?: EditorCondition }>) =>
        mutate((g) => patchBranch(g, id, value, patch))
      }
      removeBranch={(value) => mutate((g) => removeBranch(g, id, value))}
      onRemove={() => editor.actions.remove(id)}
    />
  );
}
