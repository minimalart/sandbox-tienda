import { CogSixTooth, SidebarLeft } from '@medusajs/icons';
import { Drawer, Kbd, Prompt, Text, toast, Tooltip } from '@medusajs/ui';
import { useEffect, useState, type ReactElement } from 'react';

import { SHORTCUT_HELP } from './lib/keys';

import { useNavigate } from 'react-router-dom';

import { useFlowEditor } from './_use-flow-editor';
import { EditorActionsProvider } from './canvas/editor-context';
import { FlowCanvas } from './canvas/flow-canvas';
import { useFillHeight } from './canvas/use-fill-height';
import { FlowHeader } from './panels/header';
import { Inspector } from './panels/inspector';
import { StepLibrary } from './panels/library';
import { ModeBar } from './panels/mode-bar';
import { IssuesDrawer, SettingsDrawer } from './panels/settings-drawer';
import { SimulatorPanel } from './panels/simulator';
import { VersionsDrawer } from './panels/versions';

/**
 * El armado de la pantalla: encabezado arriba, biblioteca a la izquierda y el canvas
 * quedándose con TODO el resto del ancho.
 *
 * La columna fija de la derecha ya no existe. Ocupaba un cuarto de la pantalla y,
 * sin nada seleccionado, mostraba configuración que se toca una vez cada mucho. Ahora
 * el inspector aparece como cajón al elegir un paso, la configuración vive detrás de
 * la rueda dentada que flota sobre el canvas, y los problemas se abren desde su badge.
 *
 * Todo el estado vive en `useFlowEditor` y todas las decisiones en módulos puros con
 * test. Este archivo existe para que el canvas sea el producto principal de la
 * pantalla y no un rectángulo rodeado de formularios.
 */
/** Lo que dice la barra de métricas sobre los datos que está mostrando. */
function resumenDeMetricas(editor: ReturnType<typeof useFlowEditor>): string | null {
  if (editor.analyticsLoading) return 'Cargando…';
  const datos = editor.analytics;
  if (!datos) return null;
  if (!datos.available) return datos.reason;
  const total = datos.sessions_total;
  if (total === 0) return 'Todavía no pasó ninguna conversación por este recorrido.';
  return `${total} conversación${total === 1 ? '' : 'es'}${datos.truncated ? ' (recortado)' : ''}`;
}

export function FlowEditorPage({ versionId }: { versionId: string }): ReactElement {
  const navigate = useNavigate();
  const editor = useFlowEditor(versionId);
  const hayTrabajo = editor.graph.nodes.length > 0;
  /** La columna de pasos se puede guardar para que el canvas se quede con el ancho. */
  const [libraryOpen, setLibraryOpen] = useState(true);
  const alto = useFillHeight();

  /**
   * Si hay algo abierto sobre el canvas. El inspector no tiene un `open` propio —se
   * abre solo con la selección—, así que se pregunta por lo mismo que él.
   */
  const hayPanelAbierto =
    editor.selectedIds.length > 0 ||
    editor.selectedEdgeId !== null ||
    editor.settingsOpen ||
    editor.issuesOpen ||
    editor.versionsOpen ||
    editor.simulator.open;

  /**
   * Editar el PUBLICADO y guardar no lo modifica: deja una copia en borrador, porque
   * el publicado es el que está atendiendo clientes en este momento. Hay que llevar
   * al operador a esa copia, o seguiría editando una URL que ya no es donde está su
   * trabajo.
   */
  useEffect(() => {
    if (!editor.forkedTo || editor.forkedTo === versionId) return;
    toast.success('El publicado no se toca: guardamos tus cambios en un recorrido nuevo.');
    navigate(`/whatsapp/flujos/${editor.forkedTo}`, { replace: true });
  }, [editor.forkedTo, navigate, versionId]);

  return (
    /**
     * El alto se MIDE, no se calcula contra un 57 escrito a mano: ese número no da
     * exacto siempre y lo que sobraba aparecía como unos pocos píxeles de scroll en
     * toda la página — que en un editor de canvas significa que la rueda del mouse
     * cerca de un borde mueve la página en vez del diagrama.
     */
    <div
      ref={alto.ref}
      style={alto.height ? { height: alto.height } : undefined}
      className="flex flex-col overflow-hidden"
    >
      <FlowHeader
        status={{
          // Este recorrido ES el publicado cuando su id coincide con el activo: el
          // header tiene que decir "Publicado · vN" y no "Borrador".
          hasDraft: editor.data?.active?.id !== versionId,
          activeVersion: editor.data?.active?.version ?? null,
          dirty: editor.dirty,
          saveState: editor.saveState,
          issueCount: editor.issues.length,
        }}
        onGoToIssue={() => editor.setIssuesOpen(true)}
        onTest={editor.simulator.openPanel}
        testing={editor.simulator.open}
        onUndo={editor.undo}
        onRedo={editor.redo}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onOrganize={editor.organize}
        onShowShortcuts={() => editor.setHelpOpen(true)}
        onSave={() => void editor.save()}
        onPublish={() => void editor.publish(editor.publishNotes)}
        onSeed={editor.requestSeed}
        onShowVersions={() => editor.setVersionsOpen(true)}
        seedLabel={hayTrabajo ? 'Reemplazar por el recorrido base' : 'Cargar el recorrido base'}
        busy={editor.busy}
        saving={editor.saving}
        publishing={editor.publishing}
      />

      <ModeBar
        mode={editor.mode}
        onMode={editor.setMode}
        graph={editor.graph}
        publishedGraph={editor.publishedGraph}
        analyticsDays={editor.analyticsDays}
        onAnalyticsDays={editor.setAnalyticsDays}
        analyticsSummary={resumenDeMetricas(editor)}
      />

      <div className="flex min-h-0 flex-1">
        {libraryOpen && <StepLibrary onAdd={editor.addStep} onHide={() => setLibraryOpen(false)} />}

        <div ref={editor.canvasRef} className="relative min-h-0 min-w-0 flex-1">
          {/**
            * La rueda flota sobre el canvas y no en el encabezado: es de esta pantalla
            * y no de la barra de acciones, que ya tiene Probar, Guardar y Publicar.
            *
            * DESAPARECE mientras hay un panel abierto. Los cajones del editor son
            * `modal={false}` —para poder ver el paso que se está editando— así que no
            * tapan lo que está debajo, y la rueda quedaba flotando ARRIBA del panel,
            * encima de su contenido. Esconderla no saca nada: la configuración del
            * recorrido no es algo que se toque con un paso abierto.
            */}
          {/* Gemelo de la rueda, del otro lado: devuelve la columna de pasos. Vive
              sobre el canvas y no en el encabezado por lo mismo que ella — es de esta
              pantalla, no de la barra de acciones. */}
          {!libraryOpen && (
            <Tooltip content="Mostrar los pasos">
              <button
                type="button"
                aria-label="Mostrar los pasos"
                onClick={() => setLibraryOpen(true)}
                className="absolute left-4 top-4 z-10 flex items-center justify-center rounded-full border bg-ui-bg-base p-2 shadow-elevation-card-rest hover:bg-ui-bg-base-hover"
              >
                <SidebarLeft />
              </button>
            </Tooltip>
          )}

          {!hayPanelAbierto && (
            <Tooltip content="Configuración del recorrido">
              <button
                type="button"
                aria-label="Configuración del recorrido"
                onClick={() => editor.setSettingsOpen(true)}
                className="absolute right-4 top-4 z-10 flex items-center justify-center rounded-full border bg-ui-bg-base p-2 shadow-elevation-card-rest hover:bg-ui-bg-base-hover"
              >
                <CogSixTooth />
              </button>
            </Tooltip>
          )}

          <EditorActionsProvider value={editor.actions}>
            <FlowCanvas
              nodes={editor.nodes}
              edges={editor.edges}
              onNodesChange={editor.onNodesChange}
              onEdgesChange={editor.onEdgesChange}
              onConnect={editor.connect}
              onNodeDragStop={editor.flushPositions}
              onSelectNodes={editor.setSelectedIds}
              onSelectEdge={editor.setSelectedEdgeId}
              selectedIds={editor.selectedIds}
              selectedEdgeId={editor.selectedEdgeId}
              onDeleteSelection={editor.deleteSelection}
              onDropStep={(type, position) => editor.addStep(type, position)}
              onHoverEdge={editor.setHoveredEdgeId}
              isDark={editor.isDark}
              minimapOn={editor.minimapOn}
              onToggleMinimap={editor.toggleMinimap}
            />
          </EditorActionsProvider>
        </div>

        {editor.simulator.open && (
          <SimulatorPanel
            graph={editor.graph}
            session={editor.simulator.session}
            onSendText={editor.simulator.sendText}
            onTap={editor.simulator.tap}
            onContinue={editor.simulator.continueAfterAction}
            onTimeout={editor.simulator.timeout}
            onReset={editor.simulator.reset}
            onClose={editor.simulator.close}
          />
        )}
      </div>

      {/* NINGÚN BORRADO PASA SIN PREGUNTAR: el menú de la tarjeta, el botón del panel,
          la tecla Supr y el panel de la conexión terminan todos acá. El cartel dice
          cuántas conexiones se lleva, que es lo que hace frenar cuando el número no es
          el que uno esperaba. */}
      <Prompt open={Boolean(editor.pendingDelete)} onOpenChange={(abierto) => !abierto && editor.setPendingDelete(null)}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>{editor.deletePrompt?.title ?? 'Borrar'}</Prompt.Title>
            <Prompt.Description>{editor.deletePrompt?.description ?? ''}</Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action onClick={editor.confirmDelete}>Borrar</Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>

      {/* Reemplazar por el base pisaba el borrador sin preguntar: medido, doce pasos
          dibujados reemplazados sin una confirmación. El endpoint responde 409
          justamente para eso y el front mandaba `force: true` solo. */}
      <Prompt open={editor.confirmSeed} onOpenChange={editor.setConfirmSeed}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Reemplazar el recorrido</Prompt.Title>
            <Prompt.Description>
              Esto descarta los {editor.graph.nodes.length} pasos que tenés dibujados y los cambia
              por el recorrido base. No se puede deshacer.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action onClick={() => void editor.loadSeed()}>Reemplazar</Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>

      <Inspector editor={editor} />

      <SettingsDrawer
        open={editor.settingsOpen}
        onOpenChange={editor.setSettingsOpen}
        siteId={editor.data?.site_id ?? null}
        activeVersion={editor.data?.active?.version ?? null}
        publishedAt={editor.data?.active?.published_at ?? null}
        exclusive={editor.exclusive}
        onExclusiveChange={editor.setExclusive}
        notes={editor.publishNotes}
        onNotesChange={editor.setPublishNotes}
      />

      <IssuesDrawer
        open={editor.issuesOpen}
        onOpenChange={editor.setIssuesOpen}
        issues={editor.issues}
        onGoTo={(target) => editor.goToIssue(target)}
      />

      <VersionsDrawer
        open={editor.versionsOpen}
        onOpenChange={editor.setVersionsOpen}
        versions={editor.data?.versions ?? []}

        onRestore={(id) => {
          // Restaurar crea un recorrido NUEVO: hay que ir a verlo, o el operador
          // aprieta, no pasa nada visible, y cree que falló.
          void editor.restoreVersion(id).then((nuevo) => {
            if (nuevo) navigate(`/whatsapp/flujos/${nuevo}`);
          });
        }}
        restoring={editor.restoring}
      />

      <Drawer open={editor.helpOpen} onOpenChange={editor.setHelpOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Atajos del teclado</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-2">
            {SHORTCUT_HELP.map((item) => (
              <div key={item.keys} className="flex items-center justify-between gap-x-4">
                <Text size="small">{item.what}</Text>
                <Kbd>{item.keys}</Kbd>
              </div>
            ))}
            <Text size="xsmall" className="pt-2 text-ui-fg-subtle">
              Mientras escribís en un campo, sólo Ctrl+S y Escape hacen algo: el resto es del
              campo, empezando por el deshacer del texto.
            </Text>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </div>
  );
}
