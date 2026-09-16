import { ReactFlowProvider } from '@xyflow/react';
import { useParams } from 'react-router-dom';
import type { ReactElement } from 'react';

import '@xyflow/react/dist/style.css';

import { FlowEditorPage } from '../_flow-editor-page';

/**
 * El canvas de UN recorrido.
 *
 * La ruta sólo monta. La pantalla está en `_flow-editor-page.tsx`, el estado en
 * `_use-flow-editor.ts` y todas las decisiones en módulos puros con test — necesario
 * porque el CI no typechequea `src/admin` y un componente del admin no se puede probar
 * en este repo: lo que no está en un `.ts` puro es lo que nadie verifica.
 *
 * **El id va en la URL y no en un estado de la pantalla.** Desde que hay varios
 * recorridos, cuál se está editando es parte de dónde está parado el operador: así el
 * botón de atrás del navegador vuelve a la tabla, se puede abrir dos en pestañas
 * distintas para compararlos, y recargar no cambia de recorrido.
 *
 * Sin `defineRouteConfig`: el item del menú lo pone la tabla, que es la pantalla que
 * abre esta sección. Un segundo item que lleve a un id concreto no significaría nada.
 *
 * El `ReactFlowProvider` envuelve todo y no sólo el canvas: el encabezado, la
 * biblioteca y el inspector usan `useReactFlow` —para ajustar la vista, saber el zoom
 * y traducir la posición donde se suelta un paso— y fuera del provider esos hooks
 * tiran.
 */
const FlowCanvasRoute = (): ReactElement => {
  const { id } = useParams<{ id: string }>();

  return (
    <ReactFlowProvider>
      <FlowEditorPage versionId={id ?? ''} />
    </ReactFlowProvider>
  );
};

export default FlowCanvasRoute;
