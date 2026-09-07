import { defineRouteConfig } from '@medusajs/admin-sdk';
import { useState } from 'react';
import {
  Container, Heading, Button, Table, Badge, Drawer, Input, Label, Select, Text,
  IconButton, DropdownMenu, usePrompt, toast,
} from '@medusajs/ui';
import { EllipsisHorizontal, PencilSquare, Trash } from '@medusajs/icons';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import {
  useLoyaltyPrograms, useCampaigns, useCreateCampaign, useUpdateCampaign, useDeleteCampaign, type Campaign,
} from '../../../hooks/api/loyalty';

const toLocalInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

type CampaignForm = {
  id?: string;
  name: string;
  status: 'active' | 'inactive';
  starts_at: string;
  ends_at: string;
  multiplier: string;
  priority: string;
};
const empty: CampaignForm = { name: '', status: 'active', starts_at: '', ends_at: '', multiplier: '2', priority: '0' };

const LoyaltyCampaignsPage = () => {
  const { data: programsData } = useLoyaltyPrograms();
  const program = programsData?.programs?.find((p) => p.status === 'active') ?? programsData?.programs?.[0];
  const { data, isLoading } = useCampaigns(program ? { program_id: program.id } : undefined);
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const prompt = usePrompt();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignForm>(empty);
  const set = <K extends keyof CampaignForm>(k: K, v: CampaignForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(empty); setOpen(true); };
  const openEdit = (c: Campaign) => {
    setForm({
      id: c.id, name: c.name, status: c.status, starts_at: toLocalInput(c.starts_at),
      ends_at: toLocalInput(c.ends_at), multiplier: String(c.multiplier), priority: String(c.priority),
    });
    setOpen(true);
  };
  const onSave = async () => {
    if (!program) return;
    const body = {
      program_id: program.id, name: form.name, status: form.status,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      multiplier: Number(form.multiplier) || 1, priority: Number(form.priority) || 0,
    };
    try {
      if (form.id) await updateCampaign.mutateAsync({ id: form.id, ...body });
      else await createCampaign.mutateAsync(body);
      toast.success('Campaña guardada');
      setOpen(false);
    } catch (e) { toast.error((e as Error).message); }
  };
  const onDelete = async (c: Campaign) => {
    if (!(await prompt({ title: 'Eliminar campaña', description: `¿Eliminar "${c.name}"?` }))) return;
    try { await deleteCampaign.mutateAsync(c.id); toast.success('Campaña eliminada'); } catch (e) { toast.error((e as Error).message); }
  };
  const campaigns = data?.campaigns ?? [];

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Campañas</Heading>
        <div className="flex items-center gap-3">
          <ExtensionVersion extension="loyalty" />
          <Button size="small" onClick={openCreate} disabled={!program}>Nueva campaña</Button>
        </div>
      </div>
      <SiteScopeBar screen="loyalty/campaigns" />
      {!program ? (
        <div className="px-6 py-8"><Text className="text-ui-fg-subtle">Creá el programa en Configuración primero.</Text></div>
      ) : (
        <div className="px-6 py-4">
          {isLoading ? <Text className="text-ui-fg-subtle">Cargando…</Text> : campaigns.length === 0 ? (
            <Text className="text-ui-fg-subtle">No hay campañas todavía.</Text>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Nombre</Table.HeaderCell>
                  <Table.HeaderCell>Multiplicador</Table.HeaderCell>
                  <Table.HeaderCell>Prioridad</Table.HeaderCell>
                  <Table.HeaderCell>Vigencia</Table.HeaderCell>
                  <Table.HeaderCell>Estado</Table.HeaderCell>
                  <Table.HeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {campaigns.map((c) => (
                  <Table.Row key={c.id}>
                    <Table.Cell>{c.name}</Table.Cell>
                    <Table.Cell>x{c.multiplier}</Table.Cell>
                    <Table.Cell>{c.priority}</Table.Cell>
                    <Table.Cell>
                      {c.starts_at ? new Date(c.starts_at).toLocaleDateString('es-AR') : '—'}
                      {' → '}
                      {c.ends_at ? new Date(c.ends_at).toLocaleDateString('es-AR') : '—'}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={c.status === 'active' ? 'green' : 'grey'} size="2xsmall">
                        {c.status === 'active' ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <IconButton variant="transparent"><EllipsisHorizontal /></IconButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                          <DropdownMenu.Item onClick={() => openEdit(c)}><PencilSquare className="mr-2" /> Editar</DropdownMenu.Item>
                          <DropdownMenu.Item onClick={() => onDelete(c)}><Trash className="mr-2" /> Eliminar</DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </div>
      )}
      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          <Drawer.Header><Drawer.Title>{form.id ? 'Editar campaña' : 'Nueva campaña'}</Drawer.Title></Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label size="small">Nombre</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label size="small">Multiplicador</Label>
                <Input type="number" value={form.multiplier} onChange={(e) => set('multiplier', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">Prioridad</Label>
                <Input type="number" value={form.priority} onChange={(e) => set('priority', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label size="small">Desde</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">Hasta</Label>
                <Input type="datetime-local" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small">Estado</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v as CampaignForm['status'])}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content className="z-[60]">
                  <Select.Item value="active">Activa</Select.Item>
                  <Select.Item value="inactive">Inactiva</Select.Item>
                </Select.Content>
              </Select>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={onSave} isLoading={createCampaign.isPending || updateCampaign.isPending}>Guardar</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  );
};

export const config = defineRouteConfig({ label: 'Campañas' });
export const handle = { breadcrumb: () => 'Campañas' };
export default LoyaltyCampaignsPage;
