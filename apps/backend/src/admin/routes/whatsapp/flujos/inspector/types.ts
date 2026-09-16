import type { EditorBranch, EditorCondition, GraphNode } from '../_editor';
import type { FlowOption } from '../lib/graph-contract';

/**
 * Lo que recibe el inspector de un tipo de paso.
 *
 * Todas las operaciones llegan ya atadas al paso elegido y pasan por el `mutate` del
 * editor, que vuelca las posiciones del canvas antes de tocar el grafo. Un inspector
 * que escribiera en el grafo por su cuenta se llevaría puesto lo que el operador
 * acaba de mover — el bug que costó dos PRs.
 */
export type NodeInspectorProps = {
  node: GraphNode;
  patch: (patch: Partial<GraphNode>) => void;
  patchArg: (name: string, value: unknown) => void;
  addOption: () => void;
  patchOption: (value: string, patch: Partial<FlowOption>) => void;
  removeOption: (value: string) => void;
  addBranch: () => void;
  patchBranch: (value: string, patch: Partial<{ label: string; when?: EditorCondition }>) => void;
  removeBranch: (value: string) => void;
  branches: EditorBranch[];
};
