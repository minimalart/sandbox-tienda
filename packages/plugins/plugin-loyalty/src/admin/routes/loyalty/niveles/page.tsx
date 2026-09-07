import { defineRouteConfig } from '@medusajs/admin-sdk';
import { useState } from 'react';
import {
  Container, Heading, Button, Table, Drawer, Input, Label, Select, Text,
  IconButton, DropdownMenu, usePrompt, toast,
} from '@medusajs/ui';
import { EllipsisHorizontal, PencilSquare, Trash } from '@medusajs/icons';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import {
  useLoyaltyPrograms, useTiers, useCreateTier, useUpdateTier, useDeleteTier, type Tier,
} from '../../../hooks/api/loyalty';

const COND_LABELS: Record<Tier['condition_type'], string> = {
  spend: 'Gasto acumulado',
  points: 'Puntos obtenidos',
  orders: 'Cantidad de pedidos',
};

type TierForm = {
  id?: string;
  name: string;
  condition_type: Tier['condition_type'];
  threshold: string;
  multiplier: string;
};
const empty: TierForm = { name: '', condition_type: 'points', threshold: '0', multiplier: '1' };

const LoyaltyTiersPage = () => {
  const { data: programsData } = useLoyaltyPrograms();
  const program = programsData?.programs?.find((p) => p.status === 'active') ?? programsData?.programs?.[0];
  const { data, isLoading } = useTiers(program ? { program_id: program.id } : undefined);
  const createTier = useCreateTier();
  const updateTier = useUpdateTier();
  const deleteTier = useDeleteTier();
  const prompt = usePrompt();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TierForm>(empty);
  const set = <K extends keyof TierForm>(k: K, v: TierForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(empty); setOpen(true); };
  const openEdit = (t: Tier) => {
    setForm({ id: t.id, name: t.name, condition_type: t.condition_type, threshold: String(t.threshold), multiplier: String(t.multiplier) });
    setOpen(true);
  };
  const onSave = async () => {
    if (!program) return;
    const body = {
      program_id: program.id, name: form.name, condition_type: form.condition_type,
      threshold: Number(form.threshold) || 0, multiplier: Number(form.multiplier) || 1,
    };
    try {
      if (form.id) await updateTier.mutateAsync({ id: form.id, ...body });
      else await createTier.mutateAsync(body);
      toast.success('Nivel guardado');
      setOpen(false);
    } catch (e) { toast.error((e as Error).message); }
  };
  const onDelete = async (t: Tier) => {
    if (!(await prompt({ title: 'Eliminar nivel', description: `¿Eliminar "${t.name}"?` }))) return;
    try { await deleteTier.mutateAsync(t.id); toast.success('Nivel eliminado'); } catch (e) { toast.error((e as Error).message); }
  };
  const tiers = data?.tiers ?? [];

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Niveles</Heading>
        <div className="flex items-center gap-3">
          <ExtensionVersion extension="loyalty" />
          <Button size="small" onClick={openCreate} disabled={!program}>Nuevo nivel</Button>
        </div>
      </div>
      <SiteScopeBar screen="loyalty/tiers" />
      {!program ? (
        <div className="px-6 py-8"><Text className="text-ui-fg-subtle">Creá el programa en Configuración primero.</Text></div>
      ) : (
        <div className="px-6 py-4">
          {isLoading ? <Text className="text-ui-fg-subtle">Cargando…</Text> : tiers.length === 0 ? (
            <Text className="text-ui-fg-subtle">No hay niveles todavía.</Text>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Nombre</Table.HeaderCell>
                  <Table.HeaderCell>Condición</Table.HeaderCell>
                  <Table.HeaderCell>Umbral</Table.HeaderCell>
                  <Table.HeaderCell>Multiplicador</Table.HeaderCell>
                  <Table.HeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {tiers.map((t) => (
                  <Table.Row key={t.id}>
                    <Table.Cell>{t.name}</Table.Cell>
                    <Table.Cell>{COND_LABELS[t.condition_type]}</Table.Cell>
                    <Table.Cell>{t.threshold}</Table.Cell>
                    <Table.Cell>x{t.multiplier}</Table.Cell>
                    <Table.Cell>
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <IconButton variant="transparent"><EllipsisHorizontal /></IconButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                          <DropdownMenu.Item onClick={() => openEdit(t)}><PencilSquare className="mr-2" /> Editar</DropdownMenu.Item>
                          <DropdownMenu.Item onClick={() => onDelete(t)}><Trash className="mr-2" /> Eliminar</DropdownMenu.Item>
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
          <Drawer.Header><Drawer.Title>{form.id ? 'Editar nivel' : 'Nuevo nivel'}</Drawer.Title></Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label size="small">Nombre</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small">Condición de acceso</Label>
              <Select value={form.condition_type} onValueChange={(v) => set('condition_type', v as Tier['condition_type'])}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content className="z-[60]">
                  {Object.entries(COND_LABELS).map(([value, label]) => (
                    <Select.Item key={value} value={value}>{label}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label size="small">Umbral</Label>
                <Input type="number" value={form.threshold} onChange={(e) => set('threshold', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">Multiplicador de puntos</Label>
                <Input type="number" value={form.multiplier} onChange={(e) => set('multiplier', e.target.value)} />
              </div>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={onSave} isLoading={createTier.isPending || updateTier.isPending}>Guardar</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  );
};

export const config = defineRouteConfig({ label: 'Niveles' });
export const handle = { breadcrumb: () => 'Niveles' };
export default LoyaltyTiersPage;
