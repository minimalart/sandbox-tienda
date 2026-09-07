import { defineRouteConfig } from '@medusajs/admin-sdk';
import { EllipsisHorizontal, Users } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  StatusBadge,
  Table,
  Text,
  toast,
  Toaster,
  usePrompt,
} from '@medusajs/ui';
import { SiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';
import { useState } from 'react';
import {
  type DynamicGroup,
  useDeleteDynamicGroup,
  useDynamicGroupLogs,
  useDynamicGroups,
  useRecalculateDynamicGroup,
} from '../../hooks/api/dynamic-groups';
import DynamicGroupForm from './components/dynamic-group-form';

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const LogsDrawer = ({ group, onClose }: { group: DynamicGroup | null; onClose: () => void }) => {
  const { data, isLoading } = useDynamicGroupLogs(group?.id ?? '', !!group);
  return (
    <Drawer open={!!group} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Heading>Historial — {group?.name}</Heading>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto">
          {isLoading ? (
            <Text className="text-ui-fg-subtle">Cargando…</Text>
          ) : !data?.logs.length ? (
            <Text className="text-ui-fg-subtle">Sin movimientos todavía.</Text>
          ) : (
            <div className="flex flex-col gap-2">
              {data.logs.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-lg border border-ui-border-base p-2">
                  <div className="flex items-center gap-2">
                    <Badge size="2xsmall" color={l.action === 'added' ? 'green' : 'red'}>
                      {l.action === 'added' ? 'Entró' : 'Salió'}
                    </Badge>
                    <Text size="small" className="font-mono">{l.customer_id}</Text>
                  </div>
                  <Text size="xsmall" className="text-ui-fg-subtle">{fmtDate(l.created_at)}</Text>
                </div>
              ))}
            </div>
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
};

const DynamicGroupsPage = () => {
  const { data, isLoading } = useDynamicGroups({ limit: 100 });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DynamicGroup | null>(null);
  const [logsFor, setLogsFor] = useState<DynamicGroup | null>(null);

  const recalc = useRecalculateDynamicGroup();
  const del = useDeleteDynamicGroup();
  const prompt = usePrompt();

  const groups = data?.dynamic_groups ?? [];

  const onRecalc = async (g: DynamicGroup) => {
    try {
      const { stats } = await recalc.mutateAsync(g.id);
      toast.success(`Recalculado: ${stats?.members ?? 0} miembros (+${stats?.added ?? 0} / -${stats?.removed ?? 0})`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (g: DynamicGroup) => {
    const ok = await prompt({
      title: 'Eliminar grupo',
      description: `¿Eliminar "${g.name}"? Se borra también su customer group nativo.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await del.mutateAsync(g.id);
      toast.success('Grupo eliminado');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <Container className="p-0">
        <SiteScopeBar screen="dynamic-groups" />
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-x-2">
            <Heading>Grupos Dinámicos</Heading>
            <Badge size="2xsmall">v1.3.1</Badge>
          </div>
          <Button size="small" variant="secondary" onClick={() => { setEditing(null); setFormOpen(true); }}>
            Crear
          </Button>
        </div>

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Nombre</Table.HeaderCell>
              <Table.HeaderCell>Condiciones</Table.HeaderCell>
              <Table.HeaderCell>Miembros</Table.HeaderCell>
              <Table.HeaderCell>Modo</Table.HeaderCell>
              <Table.HeaderCell>Estado</Table.HeaderCell>
              <Table.HeaderCell>Último recálculo</Table.HeaderCell>
              <Table.HeaderCell> </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row><Table.Cell colSpan={7}>Cargando…</Table.Cell></Table.Row>
            ) : groups.length === 0 ? (
              <Table.Row><Table.Cell colSpan={7}>No hay grupos dinámicos. Creá el primero.</Table.Cell></Table.Row>
            ) : (
              groups.map((g) => (
                <Table.Row key={g.id}>
                  <Table.Cell>
                    <Text size="small" weight="plus">{g.name}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge size="2xsmall">{g.conditions?.length ?? 0} · {g.match === 'all' ? 'TODAS' : 'ALGUNA'}</Badge>
                  </Table.Cell>
                  <Table.Cell>{g.last_run_stats?.members ?? '—'}</Table.Cell>
                  <Table.Cell>
                    <Badge size="2xsmall" color={g.update_mode === 'realtime' ? 'blue' : 'grey'}>
                      {g.update_mode === 'realtime' ? 'Tiempo real' : 'Manual'}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={g.is_active ? 'green' : 'grey'}>
                      {g.is_active ? 'Activo' : 'Inactivo'}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="xsmall" className="text-ui-fg-subtle">{fmtDate(g.last_run_at)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <IconButton variant="transparent"><EllipsisHorizontal /></IconButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                          <DropdownMenu.Item onClick={() => { setEditing(g); setFormOpen(true); }}>Ver</DropdownMenu.Item>
                          <DropdownMenu.Item onClick={() => { setEditing(g); setFormOpen(true); }}>Editar</DropdownMenu.Item>
                          <DropdownMenu.Item onClick={() => setLogsFor(g)}>Historial</DropdownMenu.Item>
                          <DropdownMenu.Item onClick={() => onRecalc(g)}>Recalcular</DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item className="text-ui-fg-error" onClick={() => onDelete(g)}>
                            Eliminar
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Container>

      {/*
        Card sin campos editables: el horario del barrido es el `schedule:` de un
        job y Medusa lo hornea al arrancar, así que un campo acá sería un control
        que no hace nada. La card existe para que eso esté ESCRITO en la pantalla
        donde alguien lo va a buscar, en vez de en un comentario del job.
      */}
      <Container className="mt-4">
        <div className="flex flex-col gap-2 px-6 py-4">
          <Heading level="h2">Barrido periódico</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            El recálculo en tiempo real lo hacen los subscribers; este cron sólo
            barre las reglas temporales (inactividad, cumpleaños, antigüedad).
            Configurable con la variable de entorno{' '}
            <code>DYNAMIC_GROUPS_RECALC_CRON</code> (default: <code>0 3 * * *</code>).
            Requiere reiniciar el backend después de cambiarla.
          </Text>
        </div>
      </Container>

      <DynamicGroupForm open={formOpen} onClose={() => setFormOpen(false)} group={editing} />
      <LogsDrawer group={logsFor} onClose={() => setLogsFor(null)} />
      <Toaster />
    </>
  );
};

const DynamicGroupsIcon = () => <Users style={{ color: '#7C3AED' }} />;

export const config = defineRouteConfig({
  label: 'Grupos Dinámicos',
  icon: DynamicGroupsIcon,
  rank: 90,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Grupos Dinámicos',
};

export default DynamicGroupsPage;
