import { defineRouteConfig } from '@medusajs/admin-sdk';
import { useState } from 'react';
import {
  Container,
  Heading,
  Button,
  Table,
  Badge,
  Drawer,
  Input,
  Label,
  Select,
  Textarea,
  Text,
  IconButton,
  DropdownMenu,
  usePrompt,
  toast,
} from '@medusajs/ui';
import { EllipsisHorizontal, PencilSquare, Trash } from '@medusajs/icons';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import {
  useLoyaltyPrograms,
  useRewards,
  useCreateReward,
  useUpdateReward,
  useDeleteReward,
  type Reward,
  type RewardType,
} from '../../../hooks/api/loyalty';

const TYPE_LABELS: Record<RewardType, string> = {
  fixed_discount: 'Descuento fijo',
  percent_discount: 'Descuento %',
  free_shipping: 'Envío gratis',
  free_product: 'Producto gratis',
  store_credit: 'Store credit',
  custom: 'Personalizada',
};

type RewardForm = {
  id?: string;
  name: string;
  description: string;
  type: RewardType;
  cost_points: string;
  value: string;
  product_id: string;
  stock: string;
  status: 'active' | 'inactive';
};

const emptyForm: RewardForm = {
  name: '',
  description: '',
  type: 'percent_discount',
  cost_points: '500',
  value: '10',
  product_id: '',
  stock: '',
  status: 'active',
};

const usesValue = (t: RewardType) => t === 'fixed_discount' || t === 'percent_discount' || t === 'store_credit';

const LoyaltyRewardsPage = () => {
  const { data: programsData } = useLoyaltyPrograms();
  const program = programsData?.programs?.find((p) => p.status === 'active') ?? programsData?.programs?.[0];
  const { data, isLoading } = useRewards(program ? { program_id: program.id } : undefined);
  const createReward = useCreateReward();
  const updateReward = useUpdateReward();
  const deleteReward = useDeleteReward();
  const prompt = usePrompt();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RewardForm>(emptyForm);
  const set = <K extends keyof RewardForm>(k: K, v: RewardForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (r: Reward) => {
    setForm({
      id: r.id,
      name: r.name,
      description: r.description ?? '',
      type: r.type,
      cost_points: String(r.cost_points),
      value: r.config?.value != null ? String(r.config.value) : '',
      product_id: r.config?.product_id ?? '',
      stock: r.stock != null ? String(r.stock) : '',
      status: r.status,
    });
    setOpen(true);
  };

  const onSave = async () => {
    if (!program) return;
    const config: Record<string, unknown> = {};
    if (usesValue(form.type)) config.value = Number(form.value) || 0;
    if (form.type === 'store_credit') config.currency_code = program.currency_code;
    if (form.type === 'free_product' && form.product_id) config.product_id = form.product_id;

    const body = {
      program_id: program.id,
      name: form.name,
      description: form.description || null,
      type: form.type,
      cost_points: Number(form.cost_points) || 0,
      config,
      stock: form.stock === '' ? null : Number(form.stock),
      status: form.status,
    };
    try {
      if (form.id) await updateReward.mutateAsync({ id: form.id, ...body });
      else await createReward.mutateAsync(body);
      toast.success('Recompensa guardada');
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (r: Reward) => {
    const ok = await prompt({ title: 'Eliminar recompensa', description: `¿Eliminar "${r.name}"?` });
    if (!ok) return;
    try {
      await deleteReward.mutateAsync(r.id);
      toast.success('Recompensa eliminada');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const rewards = data?.rewards ?? [];

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Recompensas</Heading>
        <div className="flex items-center gap-3">
          <ExtensionVersion extension="loyalty" />
          <Button size="small" onClick={openCreate} disabled={!program}>
            Nueva recompensa
          </Button>
        </div>
      </div>
      <SiteScopeBar screen="loyalty/rewards" />

      {!program && (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Creá el programa en Configuración antes de agregar recompensas.</Text>
        </div>
      )}

      {program && (
        <div className="px-6 py-4">
          {isLoading ? (
            <Text className="text-ui-fg-subtle">Cargando…</Text>
          ) : rewards.length === 0 ? (
            <Text className="text-ui-fg-subtle">No hay recompensas todavía.</Text>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Nombre</Table.HeaderCell>
                  <Table.HeaderCell>Tipo</Table.HeaderCell>
                  <Table.HeaderCell>Costo</Table.HeaderCell>
                  <Table.HeaderCell>Stock</Table.HeaderCell>
                  <Table.HeaderCell>Estado</Table.HeaderCell>
                  <Table.HeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rewards.map((r) => (
                  <Table.Row key={r.id}>
                    <Table.Cell>{r.name}</Table.Cell>
                    <Table.Cell>{TYPE_LABELS[r.type]}</Table.Cell>
                    <Table.Cell>{r.cost_points} pts</Table.Cell>
                    <Table.Cell>{r.stock == null ? '∞' : r.stock}</Table.Cell>
                    <Table.Cell>
                      <Badge color={r.status === 'active' ? 'green' : 'grey'} size="2xsmall">
                        {r.status === 'active' ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <IconButton variant="transparent">
                            <EllipsisHorizontal />
                          </IconButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                          <DropdownMenu.Item onClick={() => openEdit(r)}>
                            <PencilSquare className="mr-2" /> Editar
                          </DropdownMenu.Item>
                          <DropdownMenu.Item onClick={() => onDelete(r)}>
                            <Trash className="mr-2" /> Eliminar
                          </DropdownMenu.Item>
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
          <Drawer.Header>
            <Drawer.Title>{form.id ? 'Editar recompensa' : 'Nueva recompensa'}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
            <div className="flex flex-col gap-1">
              <Label size="small">Nombre</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small">Descripción</Label>
              <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label size="small">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => set('type', v as RewardType)}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content className="z-[60]">
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <Select.Item key={value} value={value}>
                        {label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">Costo (puntos)</Label>
                <Input type="number" value={form.cost_points} onChange={(e) => set('cost_points', e.target.value)} />
              </div>
            </div>

            {usesValue(form.type) && (
              <div className="flex flex-col gap-1">
                <Label size="small">
                  {form.type === 'percent_discount' ? 'Porcentaje (%)' : form.type === 'store_credit' ? 'Monto de crédito' : 'Monto del descuento'}
                </Label>
                <Input type="number" value={form.value} onChange={(e) => set('value', e.target.value)} />
              </div>
            )}
            {form.type === 'free_product' && (
              <div className="flex flex-col gap-1">
                <Label size="small">Product ID gratis</Label>
                <Input value={form.product_id} onChange={(e) => set('product_id', e.target.value)} placeholder="prod_..." />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label size="small">Stock (vacío = ilimitado)</Label>
                <Input type="number" value={form.stock} onChange={(e) => set('stock', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">Estado</Label>
                <Select value={form.status} onValueChange={(v) => set('status', v as RewardForm['status'])}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content className="z-[60]">
                    <Select.Item value="active">Activa</Select.Item>
                    <Select.Item value="inactive">Inactiva</Select.Item>
                  </Select.Content>
                </Select>
              </div>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={onSave} isLoading={createReward.isPending || updateReward.isPending}>
              Guardar
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'Recompensas',
});

export const handle = {
  breadcrumb: () => 'Recompensas',
};

export default LoyaltyRewardsPage;
