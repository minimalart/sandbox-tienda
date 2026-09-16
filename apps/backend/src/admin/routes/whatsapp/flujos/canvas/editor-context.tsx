import { createContext, useContext, type ReactNode } from 'react';

import type { NodeType } from '../_editor';

/**
 * Lo que una tarjeta o una flecha pueden PEDIRLE al editor.
 *
 * Va por contexto y no por `data` del nodo porque `data` viaja dentro del estado de
 * React Flow: meter funciones ahí obliga a reproyectar el canvas entero cada vez que
 * cambia una de ellas, y como se recrean en cada render, eso es siempre.
 *
 * `hoveredEdgeId` también vive acá y no en el estado de las aristas por lo mismo:
 * pasar el mouse por una flecha no puede repintar las cuarenta.
 */
export type EditorActions = {
  insertBetween: (edgeId: string, type: NodeType) => void;
  addAndConnect: (sourceId: string, handleId: string, type: NodeType) => void;
  duplicate: (nodeId: string) => void;
  remove: (nodeId: string) => void;
  hoveredEdgeId: string | null;
};

const NOOP: EditorActions = {
  insertBetween: () => undefined,
  addAndConnect: () => undefined,
  duplicate: () => undefined,
  remove: () => undefined,
  hoveredEdgeId: null,
};

const EditorActionsContext = createContext<EditorActions>(NOOP);

export const useEditorActions = (): EditorActions => useContext(EditorActionsContext);

export function EditorActionsProvider({
  value,
  children,
}: {
  value: EditorActions;
  children: ReactNode;
}) {
  return <EditorActionsContext.Provider value={value}>{children}</EditorActionsContext.Provider>;
}
