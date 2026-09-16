import type { ReactElement } from 'react';

import type { NodeType } from '../_editor';
import { ActionInspector } from './action-inspector';
import { AgentInspector } from './agent-inspector';
import { AskInspector } from './ask-inspector';
import { ConditionInspector } from './condition-inspector';
import { AskTextInspector, MessageInspector } from './message-inspector';
import { HandoffInspector, StartInspector } from './start-inspector';
import type { NodeInspectorProps } from './types';

/**
 * QUÉ FORMULARIO LE CORRESPONDE A CADA PASO.
 *
 * La mitad React del registry: la parte pura —grupo, forma, resumen, salidas— vive en
 * `lib/registry.ts` con tests, y acá queda sólo el mapa a componentes.
 *
 * Existe para que sumar un tipo de paso sea agregar una fila acá y otra en
 * `NODE_META`, en vez de encontrar los cuatro `if (node.type === …)` que había
 * repartidos entre el canvas, la paleta, el inspector y la proyección — y donde
 * olvidarse de uno no rompía el build: simplemente ese paso se dibujaba mal.
 */

export type NodeInspectorDefinition = {
  Inspector: (props: NodeInspectorProps) => ReactElement;
  /** Las pestañas que tiene sentido separar en este tipo. Sin esto, va todo junto. */
  tabs?: readonly string[];
};

export const REGISTRY_UI: Record<NodeType, NodeInspectorDefinition> = {
  start: { Inspector: StartInspector },
  message: { Inspector: MessageInspector },
  ask_buttons: { Inspector: AskInspector },
  ask_list: { Inspector: AskInspector },
  ask_text: { Inspector: AskTextInspector },
  condition: { Inspector: ConditionInspector },
  action: { Inspector: ActionInspector },
  agent: { Inspector: AgentInspector },
  handoff: { Inspector: HandoffInspector },
  // Un final sólo tiene el texto de despedida, que puede ir vacío para ceder el
  // turno al router o al modelo sin decirle nada al cliente.
  end: { Inspector: MessageInspector },
};
