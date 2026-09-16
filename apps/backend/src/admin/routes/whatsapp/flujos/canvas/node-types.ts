import { WaCard } from './card';
import { WaEdge } from './edge';

/**
 * FUERA DEL COMPONENTE, a propósito.
 *
 * Si estos objetos se recrean en cada render, React Flow remonta TODOS los nodos y
 * todas las aristas: se pierde la selección, se corta el arrastre a medio hacer y el
 * canvas parpadea con cada tecla que se escribe en el inspector. Es el error clásico
 * con `nodeTypes`, y el propio React Flow avisa por consola cuando lo detecta.
 */
export const NODE_TYPES_RF = { wa: WaCard };
export const EDGE_TYPES_RF = { wa: WaEdge };
