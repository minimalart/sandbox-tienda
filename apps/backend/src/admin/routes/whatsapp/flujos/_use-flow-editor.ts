import { toast } from '@medusajs/ui';
import { useReactFlow, useEdgesState, useNodesState, type Edge, type Node } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  usePublishWhatsappFlow,
  useRestoreWhatsappFlowVersion,
  useSaveWhatsappFlow,
  useWhatsappFlowVersion,
  useWhatsappFlowAnalytics,
  useWhatsappFlows,
} from '../../../hooks/api/whatsapp-flows';
import {
  addAndConnect as addAndConnectIn,
  addNode as addNodeTo,
  applyPositions,
  connect as connectIn,
  duplicateNode as duplicateNodeIn,
  EMPTY_GRAPH,
  insertBetween as insertBetweenIn,
  removeEdge,
  type Graph,
  type NodeType,
} from './_editor';
import { useIsDark } from './canvas/use-is-dark';
import {
  copySubgraph,
  EMPTY_CLIP,
  pasteSubgraph,
  removeNodes,
  type Clip,
} from './lib/clipboard';
import {
  canRedo as puedeRehacer,
  canUndo as puedeDeshacer,
  push,
  redo as rehacerEn,
  resetHistory,
  startHistory,
  undo as deshacerEn,
  type History,
} from './lib/history';
import { describeDeletion, type PendingDelete } from './lib/delete-prompt';
import { isEditableTarget, shortcutFor } from './lib/keys';
import {
  compareOverlay,
  EMPTY_OVERLAY,
  metricsOverlay,
  type CanvasMode,
  type CanvasOverlay,
} from './lib/overlays';
import { asPositionList, autoLayout, wouldMove } from './lib/layout';
import { normalizeGraph, SEED_GRAPH } from './lib/graph-contract';
import {
  liveIssues,
  nextIssueTarget,
  type EditorIssue,
  type IssueTarget,
} from './lib/issues';
import { nudgeFree, viewportCenterPosition, type XY } from './lib/placement';
import {
  continueAfterAction as continueAfterActionIn,
  letTimeoutFire,
  sendText as sendTextIn,
  startSession,
  tap as tapIn,
  type SimSession,
} from './lib/simulator';
import { traceOf, type Trace } from './lib/trace';
import { shouldShowMinimap, type SaveState } from './lib/status';
import { mergeCanvasState, toCanvas } from './lib/to-canvas';

/**
 * EL ORQUESTADOR.
 *
 * Concentra el estado y los efectos del editor para que los componentes no tengan
 * más que dibujar. No toma decisiones: cada una está en un módulo puro y con test
 * (`_editor.ts`, `lib/*`). Un componente del admin no se puede testear en este repo,
 * así que una decisión acá adentro sería una que nadie verifica.
 *
 * ─── LA REGLA QUE ORDENA TODO ────────────────────────────────────────────────────
 *
 * `graph` es la ÚNICA fuente de verdad. El estado de React Flow es una proyección
 * que se recalcula en UN solo efecto. Antes había tres caminos que escribían en el
 * estado de React Flow —el repintado, el cambio de tema y la carga inicial— y cada
 * uno reimplementaba "conservar posiciones"; el día que uno se olvidó, agregar un
 * paso borraba las conexiones.
 *
 * Nada escribe en `graph` salvo `mutate()`, que primero VUELCA las posiciones que el
 * operador movió. Sin ese volcado, cualquier operación devuelve el grafo con las
 * posiciones viejas y las tarjetas saltan al lugar donde estaban.
 */

export type FlowEditorState = ReturnType<typeof useFlowEditor>;

/**
 * Qué decirle al operador cuando una escritura falla.
 *
 * "Unauthorized" pelado manda a buscar el problema en el recorrido: se lee igual que
 * un rechazo por validación, y no lo es — el borrador se guarda IGUAL con problemas, a
 * propósito. Un 401 es la sesión del backoffice vencida y lo único que hay que hacer
 * es volver a entrar. Visto en producción el 2026-09-16, con el badge diciendo "No se
 * pudo guardar" y nadie sabiendo por qué.
 */
function explicarFalla(accion: string, error: unknown): string {
  const mensaje = (error as Error)?.message ?? '';
  if (/unauthorized|401/i.test(mensaje)) {
    return `${accion}: se venció la sesión del backoffice. Abrí el admin en otra pestaña para volver a entrar y probá de nuevo, sin recargar esta — si recargás, perdés lo que no guardaste.`;
  }
  return `${accion}: ${mensaje}`;
}

/**
 * @param versionId El borrador que se está editando. Viene de la URL: desde que hay
 *   varios recorridos, "el borrador" ya no identifica a ninguno, y guardar sin saber
 *   cuál sería guardar uno encima de otro.
 */
export function useFlowEditor(versionId: string) {
  const isDark = useIsDark();
  const { fitView, getViewport, zoomIn, zoomOut } = useReactFlow();
  const { data, isLoading } = useWhatsappFlows();
  const { data: abierto, isLoading: cargandoVersion } = useWhatsappFlowVersion(versionId);
  const saveMut = useSaveWhatsappFlow();
  const publishMut = usePublishWhatsappFlow();

  /**
   * El grafo vive DENTRO de un historial.
   *
   * Deshacer era la falta más cara del editor: borrar un paso se llevaba sus flechas,
   * y la única forma de volver atrás era recargar la página perdiendo todo lo no
   * guardado. Con "Reemplazar por el base" al lado, un clic equivocado costaba media
   * hora.
   */
  const [history, setHistory] = useState<History>(() => startHistory(EMPTY_GRAPH));
  const graph = history.present;
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [exclusive, setExclusive] = useState(false);
  const [confirmSeed, setConfirmSeed] = useState(false);
  /**
   * A dónde se fue el trabajo cuando guardar creó un recorrido NUEVO.
   *
   * Pasa al editar el publicado: el servidor no le pisa el grafo —es el registro de
   * lo que atendió clientes— y guarda una copia en borrador. Sin esto, el operador
   * seguiría en la URL del publicado creyendo que lo modificó, y cada guardada
   * posterior crearía otro borrador más.
   */
  const [forkedTo, setForkedTo] = useState<string | null>(null);

  /**
   * La selección es una LISTA: se eligen varios pasos con Shift o con un recuadro,
   * para copiarlos o borrarlos de una. El inspector sigue trabajando sobre uno solo
   * —editar dos pasos a la vez no significa nada—, así que con más de uno muestra el
   * panel del recorrido.
   */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const selectedNodeId = selectedIds.length === 1 ? (selectedIds[0] as string) : null;
  const setSelectedNodeId = useCallback((id: string | null) => setSelectedIds(id ? [id] : []), []);
  const [clip, setClip] = useState<Clip>(EMPTY_CLIP);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [minimapPref, setMinimapPref] = useState<boolean | null>(null);
  const [issueCursor, setIssueCursor] = useState<IssueTarget | null>(null);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [session, setSession] = useState<SimSession>(() => startSession());

  /**
   * El mismo dibujo contesta tres preguntas: qué hace el recorrido, qué cambia
   * respecto de lo publicado, y por dónde pasa la gente de verdad. Tres pantallas
   * separadas obligarían a cruzar a mano tres versiones del mismo diagrama.
   */
  const [mode, setMode] = useState<CanvasMode>('edit');
  /** Qué cambió. Va con la publicación y es lo que después deja leer el historial. */
  const [publishNotes, setPublishNotes] = useState('');
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [versionsOpen, setVersionsOpen] = useState(false);
  /** La configuración del recorrido, detrás de la rueda que flota sobre el canvas. */
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** La lista de problemas, detrás de su badge en el encabezado. */
  const [issuesOpen, setIssuesOpen] = useState(false);

  /**
   * NINGÚN BORRADO PASA SIN PREGUNTAR.
   *
   * Borrar un paso se lleva todas sus conexiones —las que salen y las que llegan—, así
   * que puede desarmar una rama que el operador no está mirando. Todos los caminos que
   * borran (el menú de la tarjeta, el botón del panel, la tecla Supr y el panel de la
   * conexión) pasan por acá y terminan en el mismo cartel.
   */
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  /**
   * Los problemas que el servidor reportó en el último guardado.
   *
   * El editor calcula los suyos con la MISMA función, así que normalmente coinciden.
   * Se guardan aparte para cubrir el caso en que el servidor esté adelantado del
   * bundle del admin y tenga un chequeo que acá todavía no existe: sin esto, el
   * editor diría que todo está bien y Publicar rechazaría sin explicar qué.
   */
  const [serverIssues, setServerIssues] = useState<EditorIssue[]>([]);
  const [issues, setIssues] = useState<EditorIssue[]>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // El tamaño del canvas, para poder poner un paso nuevo en el centro de lo que el
  // operador está mirando.
  const canvasRef = useRef<HTMLDivElement | null>(null);

  /**
   * Se carga UNA vez. Los refetch que disparan guardar y publicar no pueden pisar lo
   * que el operador está editando. Cambiar de tienda recarga la página entera, así
   * que no hay forma de que el grafo cargado sea de otra tienda.
   */
  useEffect(() => {
    if (loaded || isLoading || cargandoVersion || !data || !abierto) return;
    // Se edita LA versión que pide la URL, no "el borrador que haya": con varios, la
    // segunda opción abriría uno cualquiera.
    const inicial = normalizeGraph(abierto.version.graph);
    // Historial NUEVO: deshacer hasta antes de la carga dejaría el canvas mostrando
    // un recorrido que ya no es el que se está editando.
    setHistory(resetHistory(inicial));
    setExclusive(data.active?.metadata?.exclusive === true);
    setLoaded(true);
  }, [abierto, cargandoVersion, data, isLoading, loaded]);

  /** Los problemas se recalculan con un respiro, para no validar en cada tecla. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setIssues(liveIssues(graph));
      // Los del servidor se descartan al cambiar el grafo: mantenerlos mostraría un
      // problema que el operador ya arregló.
      setServerIssues([]);
    }, 150);
    return () => clearTimeout(timer);
  }, [graph]);

  const allIssues = useMemo(() => {
    const conocidos = new Set(issues.map((i) => `${i.nodeId ?? ''}|${i.edgeId ?? ''}|${i.message}`));
    const extra = serverIssues.filter(
      (i) => !conocidos.has(`${i.nodeId ?? ''}|${i.edgeId ?? ''}|${i.message}`),
    );
    return [...issues, ...extra];
  }, [issues, serverIssues]);

  /**
   * Por dónde pasó la prueba, para pintarlo sobre el canvas.
   *
   * Sólo mientras el simulador está abierto: dejar el camino encendido después de
   * cerrarlo haría que el canvas muestre el resultado de una prueba vieja como si
   * fuera el estado del recorrido.
   */
  const trace = useMemo<Trace | undefined>(() => {
    if (!simulatorOpen) return undefined;
    return traceOf(graph, session.state.visited, session.state.answers, session.visitedBefore);
  }, [graph, session, simulatorOpen]);

  // ─── Comparar y medir ───────────────────────────────────────────────────────

  const publishedGraph = useMemo(
    () => (data?.active?.graph ? normalizeGraph(data.active.graph) : null),
    [data?.active?.graph],
  );

  const analyticsQuery = useWhatsappFlowAnalytics(analyticsDays, mode === 'metrics');

  const overlay = useMemo<CanvasOverlay>(() => {
    if (mode === 'compare') {
      // Sin nada publicado, todo el recorrido es nuevo — y decirlo así es más útil
      // que no mostrar nada.
      return compareOverlay(graph, publishedGraph ?? { nodes: [], edges: [] });
    }
    if (mode === 'metrics') {
      const datos = analyticsQuery.data;
      if (!datos || !datos.available) return EMPTY_OVERLAY;
      return metricsOverlay(datos);
    }
    return EMPTY_OVERLAY;
  }, [analyticsQuery.data, graph, mode, publishedGraph]);

  /** EL ÚNICO camino del grafo al canvas. */
  useEffect(() => {
    if (!loaded) return;
    const proyeccion = toCanvas(graph, {
      issues: allIssues,
      isDark,
      selectedIds,
      selectedEdgeId,
      ...(trace ? { trace } : {}),
      overlay,
    });
    setNodes((previos) => mergeCanvasState(proyeccion.nodes, previos));
    setEdges(proyeccion.edges);
  }, [graph, allIssues, isDark, selectedIds, selectedEdgeId, trace, overlay, loaded, setNodes, setEdges]);

  /**
   * Recargar o cerrar la pestaña con cambios sin guardar se llevaba el trabajo en
   * silencio. Sólo cubre recarga y cierre: la navegación interna del admin es de
   * react-router y no dispara este evento — por eso además está el badge.
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // ─── Escribir en el grafo ───────────────────────────────────────────────────

  const nodesRef = useRef<Node[]>(nodes);
  nodesRef.current = nodes;

  /** Vuelca sobre un grafo las posiciones que el operador movió en el canvas. */
  const conPosiciones = useCallback(
    (base: Graph): Graph =>
      applyPositions(
        base,
        nodesRef.current.map((n) => ({ id: n.id, position: n.position })),
      ),
    [],
  );

  const currentGraph = useCallback((): Graph => conPosiciones(graph), [conPosiciones, graph]);

  /**
   * La ÚNICA escritura al grafo. Vuelca las posiciones antes de operar —si no,
   * cualquier operación devuelve el grafo con las posiciones viejas y las tarjetas
   * saltan al lugar donde estaban— y apila la edición en el historial.
   *
   * La clave agrupa el tipeo seguido en el mismo campo: sin ella, escribir "Hola"
   * deja cuatro entradas y deshacer borra una letra por vez.
   */
  const mutate = useCallback(
    (op: (g: Graph) => Graph, historyKey?: string) => {
      setHistory((h) => push(h, op(conPosiciones(h.present)), historyKey ? { key: historyKey } : {}));
      setDirty(true);
    },
    [conPosiciones],
  );

  /** Al soltar un nodo, su posición nueva entra al grafo y al historial. */
  const flushPositions = useCallback(() => {
    setHistory((h) => push(h, conPosiciones(h.present)));
    setDirty(true);
  }, [conPosiciones]);

  const undo = useCallback(() => {
    setHistory((h) => (puedeDeshacer(h) ? deshacerEn(h) : h));
    setDirty(true);
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => (puedeRehacer(h) ? rehacerEn(h) : h));
    setDirty(true);
  }, []);

  const posiciones = useCallback(
    (): Array<XY | undefined> => graph.nodes.map((n) => n.position),
    [graph.nodes],
  );

  /** Dónde poner un paso agregado con un clic: el centro de lo que se está mirando. */
  const centro = useCallback((): XY => {
    const box = canvasRef.current?.getBoundingClientRect();
    const base = viewportCenterPosition(getViewport(), {
      width: box?.width ?? 900,
      height: box?.height ?? 600,
    });
    return nudgeFree(base, posiciones());
  }, [getViewport, posiciones]);

  const addStep = useCallback(
    (type: NodeType, position?: XY) => {
      const at = position ? nudgeFree(position, posiciones()) : centro();
      let nuevoId = '';
      mutate((g) => {
        const { graph: next, id } = addNodeTo(g, type, at);
        nuevoId = id;
        return next;
      });
      // Se selecciona para que el inspector quede listo: un paso nuevo siempre hay
      // que configurarlo, y hacer un clic más para llegar ahí es fricción pura.
      if (nuevoId) {
        setSelectedNodeId(nuevoId);
        setSelectedEdgeId(null);
      }
    },
    [centro, mutate, posiciones],
  );

  const actions = useMemo(
    () => ({
      insertBetween: (edgeId: string, type: NodeType) => {
        let nuevoId: string | null = null;
        mutate((g) => {
          const result = insertBetweenIn(g, edgeId, type);
          nuevoId = result.id;
          return result.graph;
        });
        if (nuevoId) {
          setSelectedNodeId(nuevoId);
          setSelectedEdgeId(null);
        }
      },
      addAndConnect: (sourceId: string, handleId: string, type: NodeType) => {
        let nuevoId: string | null = null;
        mutate((g) => {
          const result = addAndConnectIn(g, sourceId, handleId, type);
          nuevoId = result.id;
          return result.graph;
        });
        if (nuevoId) {
          setSelectedNodeId(nuevoId);
          setSelectedEdgeId(null);
        }
      },
      duplicate: (nodeId: string) => {
        let nuevoId: string | null = null;
        mutate((g) => {
          const result = duplicateNodeIn(g, nodeId);
          nuevoId = result.id;
          return result.graph;
        });
        if (nuevoId) setSelectedNodeId(nuevoId);
      },
      remove: (nodeId: string) => setPendingDelete({ kind: 'nodes', ids: [nodeId] }),
      hoveredEdgeId,
    }),
    [hoveredEdgeId, mutate],
  );

  /** Pide borrar lo que esté elegido. La confirmación es la que borra. */
  const deleteSelection = useCallback(() => {
    if (selectedIds.length > 0) {
      setPendingDelete({ kind: 'nodes', ids: selectedIds });
      return;
    }
    if (selectedEdgeId) setPendingDelete({ kind: 'edge', id: selectedEdgeId });
  }, [selectedEdgeId, selectedIds]);

  /** Pide borrar una conexión concreta, desde su panel. */
  const requestDeleteEdge = useCallback(
    (id: string) => setPendingDelete({ kind: 'edge', id }),
    [],
  );

  const deletePrompt = useMemo(
    () => (pendingDelete ? describeDeletion(graph, pendingDelete) : null),
    [graph, pendingDelete],
  );

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === 'edge') {
      const id = pendingDelete.id;
      mutate((g) => removeEdge(g, id));
      setSelectedEdgeId(null);
    } else {
      const ids = pendingDelete.ids;
      mutate((g) => removeNodes(g, ids));
      // Se sacan de la selección sin tocar el resto: borrar uno de varios elegidos no
      // puede deseleccionar los otros.
      setSelectedIds((actuales) => actuales.filter((id) => !ids.includes(id)));
    }
    setPendingDelete(null);
  }, [mutate, pendingDelete]);

  // ─── Copiar, pegar, acomodar ────────────────────────────────────────────────

  const copySelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    setClip(copySubgraph(currentGraph(), selectedIds));
    const cuantos = selectedIds.length;
    toast.success(cuantos === 1 ? 'Paso copiado.' : `${cuantos} pasos copiados.`);
  }, [currentGraph, selectedIds]);

  /** Pega el último recorte y deja seleccionado lo pegado, para poder moverlo de una. */
  const pegar = useCallback(
    (recorte: Clip) => {
      if (recorte.nodes.length === 0) return;
      let pegados: string[] = [];
      mutate((g) => {
        const result = pasteSubgraph(g, recorte);
        pegados = result.ids;
        return result.graph;
      });
      if (pegados.length > 0) setSelectedIds(pegados);
    },
    [mutate],
  );

  const pasteClip = useCallback(() => pegar(clip), [clip, pegar]);

  const duplicateSelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    pegar(copySubgraph(currentGraph(), selectedIds));
  }, [currentGraph, pegar, selectedIds]);

  const selectAll = useCallback(() => setSelectedIds(graph.nodes.map((n) => n.id)), [graph.nodes]);

  /**
   * Acomoda el recorrido en capas.
   *
   * SÓLO por acción explícita: que el canvas se reacomode solo mientras alguien dibuja
   * es de las cosas más frustrantes que puede hacer un editor, porque se pierde el
   * mapa mental de dónde estaba cada cosa. Entra al historial como una edición más,
   * así que se deshace.
   */
  const organize = useCallback(() => {
    const base = currentGraph();
    const medidas = new Map(nodesRef.current.map((n) => [n.id, n.measured?.height ?? 0]));
    const posiciones = autoLayout(base, { heightOf: (id) => medidas.get(id) || 96 });
    if (!wouldMove(base, posiciones)) {
      toast.info('El recorrido ya está acomodado.');
      return;
    }
    mutate((g) => applyPositions(g, asPositionList(posiciones)));
    setTimeout(() => fitView({ duration: 300, padding: 0.15, maxZoom: 1 }), 50);
  }, [currentGraph, fitView, mutate]);

  // ─── Guardar, publicar, cargar el base ──────────────────────────────────────

  const save = useCallback(async (): Promise<boolean> => {
    setSaveState('saving');
    try {
      const result = await saveMut.mutateAsync({ version_id: versionId, graph: currentGraph() as never });
      if (result.draft.id !== versionId) setForkedTo(result.draft.id);
      setServerIssues(
        (result.issues ?? []).map((i) => ({ ...i, severity: 'blocking' as const })),
      );
      setDirty(false);
      setSaveState('idle');
      return true;
    } catch (error) {
      setSaveState('error');
      toast.error(explicarFalla('No se pudo guardar', error));
      return false;
    }
  }, [currentGraph, saveMut, versionId]);

  const saveManual = useCallback(async () => {
    if (await save()) toast.success('Borrador guardado.');
  }, [save]);

  /** Publicar guarda primero: se publica lo que está en pantalla, no lo último guardado. */
  const publish = useCallback(
    async (notes?: string) => {
      setSaveState('saving');
      try {
        const saved = await saveMut.mutateAsync({ version_id: versionId, graph: currentGraph() as never });
        const problemas = (saved.issues ?? []).map((i) => ({ ...i, severity: 'blocking' as const }));
        setServerIssues(problemas);
        setDirty(false);
        setSaveState('idle');
        if (problemas.length > 0) {
          toast.error('Hay problemas que resolver antes de publicar.');
          return;
        }
        await publishMut.mutateAsync({
          version_id: versionId,
          exclusive,
          ...(notes?.trim() ? { notes: notes.trim() } : {}),
        });
        setPublishNotes('');
        toast.success('Publicado: el bot ya atiende con este recorrido.');
      } catch (error) {
        setSaveState('error');
        toast.error(explicarFalla('No se pudo publicar', error));
      }
    },
    [currentGraph, exclusive, publishMut, saveMut, versionId],
  );

  /**
   * Reemplaza el canvas por el recorrido de ejemplo.
   *
   * Es una operación del EDITOR y no una llamada al servidor: el ejemplo es una
   * constante que el cliente ya tiene. Así entra en el historial —Ctrl+Z lo deshace—
   * y no escribe nada en la base hasta que alguien guarde, que es lo que uno espera
   * de algo que se aprieta para mirar.
   */
  const loadSeed = useCallback(() => {
    mutate(() => SEED_GRAPH as Graph, 'seed');
    setConfirmSeed(false);
    setSelectedIds([]);
    setSelectedEdgeId(null);
    toast.success('Cargado el recorrido que el bot atiende hoy. Ctrl+Z lo deshace.');
    // El recorrido base tiene quince pasos: sin ajustar, se ve una esquina.
    setTimeout(() => fitView({ duration: 300, padding: 0.15, maxZoom: 1 }), 50);
  }, [fitView, mutate]);

  /** Con trabajo en el canvas se pregunta antes: reemplaza todo lo que haya. */
  const requestSeed = useCallback(() => {
    if (graph.nodes.length === 0) void loadSeed();
    else setConfirmSeed(true);
  }, [graph.nodes.length, loadSeed]);

  // ─── Ir al próximo problema ─────────────────────────────────────────────────

  const goToIssue = useCallback(
    (target: IssueTarget | null) => {
      const next = target ?? nextIssueTarget(allIssues, issueCursor);
      if (!next) return;
      setIssueCursor(next);
      if (next.kind === 'node') {
        setSelectedNodeId(next.id);
        setSelectedEdgeId(null);
        fitView({ nodes: [{ id: next.id }], duration: 300, padding: 0.4, maxZoom: 1.2 });
        return;
      }
      setSelectedEdgeId(next.id);
      setSelectedNodeId(null);
      const edge = graph.edges.find((e) => e.id === next.id);
      if (edge) {
        fitView({
          nodes: [{ id: edge.source }, { id: edge.target }],
          duration: 300,
          padding: 0.4,
          maxZoom: 1.2,
        });
      }
    },
    [allIssues, fitView, graph.edges, issueCursor],
  );

  /**
   * TODOS los atajos en un solo lugar.
   *
   * Qué hace cada tecla —y cuándo NO tiene que hacer nada porque el foco está en un
   * campo del inspector— lo decide `shortcutFor`, que es puro y está probado. Con esa
   * decisión adentro del listener, "Ctrl+Z me deshace el canvas en vez del texto" es
   * un bug que hay que reproducir a mano cada vez.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const editing = isEditableTarget(
        event.target as { tagName?: string; isContentEditable?: boolean } | null,
      );
      const action = shortcutFor(event, { editing });
      if (!action) return;

      switch (action) {
        case 'save':
          event.preventDefault();
          void saveManual();
          return;
        case 'escape':
          if (editing) return;
          setSelectedIds([]);
          setSelectedEdgeId(null);
          setHelpOpen(false);
          return;
        case 'undo':
          event.preventDefault();
          undo();
          return;
        case 'redo':
          event.preventDefault();
          redo();
          return;
        case 'delete':
          event.preventDefault();
          deleteSelection();
          return;
        case 'copy':
          copySelection();
          return;
        case 'paste':
          event.preventDefault();
          pasteClip();
          return;
        case 'duplicate':
          event.preventDefault();
          duplicateSelection();
          return;
        case 'select-all':
          event.preventDefault();
          selectAll();
          return;
        case 'fit':
          fitView({ duration: 300, padding: 0.15 });
          return;
        case 'zoom-in':
          zoomIn({ duration: 120 });
          return;
        case 'zoom-out':
          zoomOut({ duration: 120 });
          return;
        case 'help':
          setHelpOpen((open) => !open);
          return;
        default:
          return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    copySelection,
    deleteSelection,
    duplicateSelection,
    fitView,
    pasteClip,
    redo,
    saveManual,
    selectAll,
    undo,
    zoomIn,
    zoomOut,
  ]);

  // ─── El simulador ───────────────────────────────────────────────────────────

  /**
   * Corre contra el grafo que hay EN EL CANVAS, no contra lo guardado: probar lo
   * último guardado en vez de lo que se está mirando es exactamente el error que
   * hace desconfiar de una prueba.
   */
  const simulator = useMemo(
    () => ({
      open: simulatorOpen,
      session,
      openPanel: () => {
        setSimulatorOpen(true);
        setSession(startSession());
      },
      close: () => setSimulatorOpen(false),
      reset: () => setSession(startSession()),
      sendText: (text: string) => setSession((s) => sendTextIn(graph, s, text)),
      tap: (id: string, label?: string) => setSession((s) => tapIn(graph, s, id, label)),
      continueAfterAction: (vars?: Record<string, unknown>) =>
        setSession((s) => continueAfterActionIn(graph, s, vars)),
      timeout: () => setSession((s) => letTimeoutFire(graph, s)),
    }),
    [graph, session, simulatorOpen],
  );

  const restoreMut = useRestoreWhatsappFlowVersion();

  /**
   * Restaurar una versión vieja copia su grafo a un recorrido NUEVO y devuelve su id
   * para que la pantalla lleve ahí.
   *
   * Antes la traía encima de lo que se estaba editando —el borrador era uno solo— y
   * había que confirmar que se perdía el trabajo en curso. Ahora conviven: lo que se
   * estaba armando queda intacto y la versión vieja aparece al lado, para compararlas
   * antes de decidir cuál se publica.
   */
  const restoreVersion = useCallback(
    async (id: string): Promise<string | null> => {
      try {
        const result = await restoreMut.mutateAsync({ id });
        setVersionsOpen(false);
        toast.success('Copiada a un recorrido nuevo. Revisala antes de publicar.');
        return result.draft.id;
      } catch (error) {
        toast.error(explicarFalla('No se pudo restaurar', error));
        return null;
      }
    },
    [restoreMut],
  );

  const busy = saveMut.isPending || publishMut.isPending || restoreMut.isPending;

  return {
    // datos
    graph,
    data,
    isLoading,
    loaded,
    issues: allIssues,
    // canvas
    canvasRef,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    isDark,
    minimapOn: shouldShowMinimap(minimapPref, graph.nodes.length),
    toggleMinimap: () => setMinimapPref((p) => !shouldShowMinimap(p, graph.nodes.length)),
    // selección
    selectedNodeId,
    selectedIds,
    selectedEdgeId,
    setSelectedNodeId,
    setSelectedIds,
    setSelectedEdgeId,
    setHoveredEdgeId,
    // escribir
    mutate,
    flushPositions,
    requestDeleteEdge,
    pendingDelete,
    setPendingDelete,
    deletePrompt,
    confirmDelete,
    undo,
    redo,
    canUndo: puedeDeshacer(history),
    canRedo: puedeRehacer(history),
    copySelection,
    pasteClip,
    duplicateSelection,
    selectAll,
    canPaste: clip.nodes.length > 0,
    organize,
    helpOpen,
    setHelpOpen,
    connect: (connection: { source?: string | null; target?: string | null; sourceHandle?: string | null }) =>
      mutate((g) => connectIn(g, connection)),
    addStep,
    actions,
    deleteSelection,
    // estado del recorrido
    exclusive,
    setExclusive,
    dirty,
    saveState,
    busy,
    saving: saveMut.isPending,
    publishing: publishMut.isPending,
    // acciones
    save: saveManual,
    publish,
    forkedTo,
    requestSeed,
    loadSeed,
    confirmSeed,
    setConfirmSeed,
    goToIssue,
    simulator,
    // modos, versiones y métricas
    mode,
    setMode,
    publishedGraph,
    analytics: analyticsQuery.data,
    analyticsLoading: analyticsQuery.isLoading,
    analyticsDays,
    setAnalyticsDays,
    versionsOpen,
    setVersionsOpen,
    settingsOpen,
    setSettingsOpen,
    issuesOpen,
    setIssuesOpen,
    publishNotes,
    setPublishNotes,
    restoreVersion,
    restoring: restoreMut.isPending,
  };
}
