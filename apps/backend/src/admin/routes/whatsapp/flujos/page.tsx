import { defineRouteConfig } from '@medusajs/admin-sdk';
import { EllipsisHorizontal, Pencil, PencilSquare, Plus, PauseSolid, Trash } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  DropdownMenu,
  Heading,
  IconButton,
  Prompt,
  Table,
  Text,
  toast,
} from '@medusajs/ui';
import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { ExtensionVersion } from '../../../components/common/extension-version';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import {
  useDeleteWhatsappFlowDraft,
  useRenameWhatsappFlow,
  useUnpublishWhatsappFlow,
  useSaveWhatsappFlow,
  useSeedWhatsappFlow,
  useWhatsappFlows,
  type FlowListRow,
} from '../../../hooks/api/whatsapp-flows';
import { NameDrawer } from './panels/name-drawer';
import { whatsappLabel } from '../../../translations/whatsapp';

/**
 * LA TABLA DE RECORRIDOS.
 *
 * Antes esta ruta abría directamente el canvas, y había UN recorrido: el que se
 * estuviera editando. Eso obligaba a que armar uno nuevo fuera pisar el anterior, así
 * que no había forma de tener uno publicado y otro en preparación — que es
 * exactamente lo que se hace cuando se prueba un cambio grande antes de soltarlo.
 *
 * Ahora conviven **varios borradores y un solo publicado por tienda**. El publicado
 * sigue siendo uno porque es el que atiende clientes, y eso lo garantiza un índice
 * único en la base, no esta pantalla.
 */

const FECHA = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' });

const FlowListRoute = (): ReactElement => {
  const navigate = useNavigate();
  const { data, isLoading } = useWhatsappFlows();
  const crearMut = useSaveWhatsappFlow();
  const ejemploMut = useSeedWhatsappFlow();
  const borrarMut = useDeleteWhatsappFlowDraft();
  const renombrarMut = useRenameWhatsappFlow();
  const despublicarMut = useUnpublishWhatsappFlow();

  /** Qué recorrido se está por borrar. Ningún borrado pasa sin preguntar. */
  const [porBorrar, setPorBorrar] = useState<FlowListRow | null>(null);

  /**
   * Despublicar tampoco pasa sin preguntar, y por un motivo distinto al de borrar: no
   * se pierde nada, pero CAMBIA lo que le pasa al cliente que escribe en el próximo
   * minuto. El diálogo dice qué queda atendiendo, que es lo único que el operador no
   * puede deducir de la pantalla.
   */
  const [porDespublicar, setPorDespublicar] = useState<
    { id: string; name: string; version: number; general: boolean } | null
  >(null);

  /**
   * El nombre se pide ANTES de crear, no después.
   *
   * Crear y caer en el canvas con "Recorrido sin nombre" deja el trabajo de nombrarlo
   * para un momento que no llega nunca: con tres filas iguales en la tabla, elegir
   * cuál publicar es abrirlas una por una.
   */
  const [pidiendoNombre, setPidiendoNombre] = useState<
    { modo: 'crear'; template: 'blanco' | 'base' | 'compra'; sugerido: string } | { modo: 'renombrar'; row: FlowListRow } | null
  >(null);

  const ocupado =
    crearMut.isPending ||
    ejemploMut.isPending ||
    borrarMut.isPending ||
    renombrarMut.isPending ||
    despublicarMut.isPending;

  const crear = async (template: 'blanco' | 'base' | 'compra', name: string) => {
    try {
      const { draft } =
        template === 'blanco'
          ? await crearMut.mutateAsync({ name, graph: { nodes: [], edges: [] } })
          : await ejemploMut.mutateAsync({ template, name });
      setPidiendoNombre(null);
      navigate(`/whatsapp/flujos/${draft.id}`);
    } catch (error) {
      toast.error(`No se pudo crear: ${(error as Error).message}`);
    }
  };

  const renombrar = async (id: string, name: string) => {
    try {
      await renombrarMut.mutateAsync({ id, name });
      setPidiendoNombre(null);
      toast.success('Nombre cambiado.');
    } catch (error) {
      toast.error(`No se pudo cambiar el nombre: ${(error as Error).message}`);
    }
  };

  const despublicar = async () => {
    if (!porDespublicar) return;
    try {
      const out = await despublicarMut.mutateAsync({ version_id: porDespublicar.id });
      toast.success(
        out.already_off
          ? 'Ya no había ningún recorrido publicado.'
          : 'Recorrido despublicado. El bot dejó de atender con él y quedó una copia en borrador.',
      );
    } catch (error) {
      toast.error(`No se pudo despublicar: ${(error as Error).message}`);
    }
    setPorDespublicar(null);
  };

  const borrar = async () => {
    if (!porBorrar) return;
    try {
      await borrarMut.mutateAsync(porBorrar.id);
      toast.success('Recorrido borrado.');
    } catch (error) {
      toast.error(`No se pudo borrar: ${(error as Error).message}`);
    }
    setPorBorrar(null);
  };

  /**
   * El publicado arriba y los borradores después.
   *
   * No es orden alfabético ni por fecha: el publicado es el único que está
   * atendiendo gente, así que es el que hay que ver primero al entrar.
   */
  const publicado = data?.active ?? null;
  const borradores = data?.drafts ?? [];
  const vacio = !isLoading && !publicado && borradores.length === 0;

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">{whatsappLabel('NAV_FLOWS')}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {data?.site_id
              ? 'Los de esta tienda y los generales, que son los que la atienden si no tiene uno propio.'
              : 'Recorridos generales: los usa toda tienda que no tenga uno propio.'}
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          <ExtensionVersion extension="whatsapp" />
          <HelpDrawer slug="whatsapp" />
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button size="small" variant="primary" disabled={ocupado}>
                <Plus />
                Crear recorrido
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item
                onClick={() => setPidiendoNombre({ modo: 'crear', template: 'blanco', sugerido: '' })}
              >
                En blanco
              </DropdownMenu.Item>
              {/* La compra guiada va PRIMERA: es a dónde se quiere llegar. La otra es
                  lo que el bot atiende hoy, que sirve para comparar y para editar
                  sobre algo reconocible. */}
              <DropdownMenu.Item
                onClick={() =>
                  setPidiendoNombre({ modo: 'crear', template: 'compra', sugerido: 'Compra guiada' })
                }
              >
                Compra guiada (flujo de referencia)
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() =>
                  setPidiendoNombre({ modo: 'crear', template: 'base', sugerido: 'Recorrido base' })
                }
              >
                Desde el recorrido que atiende hoy
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>

      {/**
        * DE QUÉ TIENDA SON ESTOS RECORRIDOS, y cómo cambiar.
        *
        * Sin selector, la lista dependía de la tienda activa sin decirlo: un recorrido
        * armado sin tienda desaparecía en cuanto alguien elegía una, y no había forma
        * de volver a verlo. `allowInstance` es lo que da acceso a la capa general —
        * que acá no es "sin filtro" sino un recorrido de verdad, el que atiende a toda
        * tienda sin uno propio.
        */}
      <SiteScopeBar screen="whatsapp-flujos" allowInstance instanceLabel="Recorrido general" />

      {isLoading && (
        <div className="px-6 py-8">
          <Text size="small" className="text-ui-fg-subtle">
            Cargando…
          </Text>
        </div>
      )}

      {vacio && (
        <div className="flex flex-col items-center gap-y-2 px-6 py-12 text-center">
          <Text size="small" weight="plus">
            Todavía no hay ningún recorrido.
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            Un recorrido es la conversación que el bot sabe llevar: qué contesta, qué
            pregunta y a dónde va según lo que elija el cliente.
          </Text>
          <Button
            size="small"
            variant="secondary"
            className="mt-2"
            onClick={() =>
              setPidiendoNombre({ modo: 'crear', template: 'compra', sugerido: 'Compra guiada' })
            }
          >
            Empezar con la compra guiada
          </Button>
        </div>
      )}

      {!isLoading && !vacio && (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Nombre</Table.HeaderCell>
              <Table.HeaderCell>Estado</Table.HeaderCell>
              <Table.HeaderCell>Pasos</Table.HeaderCell>
              <Table.HeaderCell>Última edición</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {publicado && (
              <Fila
                row={{
                  ...publicado,
                  steps: publicado.graph?.nodes?.length ?? 0,
                  problems: 0,
                }}
                general={Boolean(data?.site_id) && !publicado.site_id}
                onOpen={() => navigate(`/whatsapp/flujos/${publicado.id}`)}
                onUnpublish={() =>
                  setPorDespublicar({
                    id: publicado.id,
                    name: nombreDe(publicado),
                    version: publicado.version ?? 0,
                    general: Boolean(data?.site_id) && !publicado.site_id,
                  })
                }
              />
            )}
            {borradores.map((row) => (
              <Fila
                key={row.id}
                row={row}
                /**
                 * Parado en una tienda, los generales se marcan. Sin la marca, editar
                 * uno de ellos creyendo que es de esta tienda cambia el recorrido de
                 * TODAS las que no tienen uno propio.
                 */
                general={Boolean(data?.site_id) && !row.site_id}
                onOpen={() => navigate(`/whatsapp/flujos/${row.id}`)}
                onRename={() => setPidiendoNombre({ modo: 'renombrar', row })}
                onDelete={() => setPorBorrar(row)}
              />
            ))}
          </Table.Body>
        </Table>
      )}

      <NameDrawer
        open={pidiendoNombre !== null}
        title={pidiendoNombre?.modo === 'renombrar' ? 'Cambiar el nombre' : 'Nombre del recorrido'}
        action={pidiendoNombre?.modo === 'renombrar' ? 'Guardar' : 'Crear'}
        initial={
          pidiendoNombre?.modo === 'renombrar'
            ? nombreDe(pidiendoNombre.row)
            : pidiendoNombre?.sugerido ?? ''
        }
        busy={ocupado}
        onOpenChange={(abierto) => !abierto && setPidiendoNombre(null)}
        onSubmit={(name) => {
          if (!pidiendoNombre) return;
          if (pidiendoNombre.modo === 'renombrar') void renombrar(pidiendoNombre.row.id, name);
          else void crear(pidiendoNombre.template, name);
        }}
      />

      {/* Despublicar no se deshace SOLO —hay que volver a publicar—, y sobre todo
          cambia lo que le contesta el bot al próximo cliente. El diálogo dice las dos
          cosas que no se ven en la tabla: qué queda atendiendo, y a quién alcanza. */}
      <Prompt
        open={porDespublicar !== null}
        onOpenChange={(open) => !open && setPorDespublicar(null)}
      >
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Despublicar “{porDespublicar?.name}”</Prompt.Title>
            <Prompt.Description>
              {porDespublicar?.general
                ? 'Es el recorrido GENERAL: dejan de atenderse con él TODAS las tiendas que no tengan uno propio. '
                : ''}
              El bot deja de llevar esta conversación y vuelve a contestar como antes de
              publicarlo. Queda una copia en borrador para seguir editándola, y la versión{' '}
              {porDespublicar?.version} se conserva en el historial.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action onClick={despublicar}>Despublicar</Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>

      {/* Borrar un recorrido no se deshace: se pregunta, y se dice qué se lleva. */}
      <Prompt open={porBorrar !== null} onOpenChange={(open) => !open && setPorBorrar(null)}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Borrar “{nombreDe(porBorrar)}”</Prompt.Title>
            <Prompt.Description>
              {porBorrar?.steps
                ? `Se pierden sus ${porBorrar.steps} pasos. Nunca atendió clientes: es un borrador.`
                : 'Está vacío, así que no se pierde nada.'}
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action onClick={borrar}>Borrar</Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  );
};

const nombreDe = (row: { name?: string | null; version?: number } | null): string =>
  (row?.name ?? '').trim() || `Versión ${row?.version ?? ''}`.trim();

function Fila({
  row,
  general = false,
  onOpen,
  onRename,
  onDelete,
  onUnpublish,
}: {
  row: FlowListRow | (FlowListRow & { graph?: unknown });
  /** Es el recorrido general y se está mirando desde una tienda. */
  general?: boolean;
  onOpen: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  /** Sólo lo recibe el publicado: es el único que se puede apagar. */
  onUnpublish?: () => void;
}): ReactElement {
  const publicado = row.status === 'active';

  return (
    <Table.Row className="cursor-pointer" onClick={onOpen}>
      <Table.Cell>
        <Text size="small" weight="plus">
          {nombreDe(row)}
        </Text>
        {row.notes && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {row.notes}
          </Text>
        )}
      </Table.Cell>
      <Table.Cell>
        <div className="flex items-center gap-x-2">
          <Badge size="2xsmall" color={publicado ? 'green' : 'grey'}>
            {publicado ? 'Publicado' : 'Borrador'}
          </Badge>
          {general && (
            <Badge size="2xsmall" color="blue">
              General
            </Badge>
          )}
          {/* Sólo en los borradores: el publicado ya pasó por la validación, y un
              recuento de problemas al lado de "Publicado" se lee como una alarma. */}
          {!publicado && row.problems > 0 && (
            <Badge size="2xsmall" color="orange">
              {row.problems === 1 ? '1 problema' : `${row.problems} problemas`}
            </Badge>
          )}
        </div>
      </Table.Cell>
      <Table.Cell>
        <Text size="small" className="text-ui-fg-subtle">
          {row.steps}
        </Text>
      </Table.Cell>
      <Table.Cell>
        <Text size="small" className="text-ui-fg-subtle">
          {row.updated_at ? FECHA.format(new Date(row.updated_at)) : '—'}
        </Text>
      </Table.Cell>
      <Table.Cell onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <IconButton size="small" variant="transparent" aria-label="Acciones">
              <EllipsisHorizontal />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item onClick={onOpen}>
              <PencilSquare className="text-ui-fg-subtle" />
              {publicado ? 'Ver' : 'Editar'}
            </DropdownMenu.Item>
            {/* Renombrar vale también para el publicado: el nombre es una etiqueta
                para el operador y no cambia nada de lo que atiende a los clientes. */}
            {onRename && (
              <DropdownMenu.Item onClick={onRename}>
                <Pencil className="text-ui-fg-subtle" />
                Cambiar el nombre
              </DropdownMenu.Item>
            )}
            {/* DESPUBLICAR es la única acción que sólo tiene el publicado, y no
                estaba: hasta acá la única forma de sacar un recorrido de encima del
                número era publicar OTRO. Un recorrido a medio terminar se quedaba
                atendiendo, y no había botón que lo apagara. */}
            {onUnpublish && (
              <DropdownMenu.Item onClick={onUnpublish}>
                <PauseSolid className="text-ui-fg-subtle" />
                Despublicar
              </DropdownMenu.Item>
            )}
            {/* El publicado no se borra: está atendiendo clientes. Se reemplaza
                publicando otro, que además deja el historial derecho. */}
            {onDelete && (
              <DropdownMenu.Item onClick={onDelete}>
                <Trash className="text-ui-fg-subtle" />
                Borrar
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu>
      </Table.Cell>
    </Table.Row>
  );
}

export default FlowListRoute;

export const config = defineRouteConfig({ label: whatsappLabel('NAV_FLOWS'), rank: 3 });

export const handle = { breadcrumb: () => whatsappLabel('NAV_FLOWS') };
