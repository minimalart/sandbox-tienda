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
  Text,
  IconButton,
  usePrompt,
  toast,
} from '@medusajs/ui';
import { EllipsisHorizontal, PencilSquare, Trash } from '@medusajs/icons';
import { DropdownMenu } from '@medusajs/ui';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import {
  useLoyaltyPrograms,
  useEarnRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  type EarnRule,
} from '../../../hooks/api/loyalty';

const EVENT_LABELS: Record<EarnRule['event'], string> = {
  purchase: 'Compra',
  signup: 'Registro',
  first_purchase: 'Primera compra',
  order_delivered: 'Pedido entregado',
  birthday: 'Cumpleaños',
  referral: 'Referido',
  comment: 'Comentario',
};

const CALC_LABELS: Record<EarnRule['calc_type'], string> = {
  fixed: 'Puntos fijos',
  percentage: 'Porcentaje',
  multiplier: 'Multiplicador',
};

type RuleForm = {
  id?: string;
  name: string;
  event: EarnRule['event'];
  calc_type: EarnRule['calc_type'];
  calc_value: string;
  priority: string;
  status: 'active' | 'inactive';
};

const emptyForm: RuleForm = {
  name: '',
  event: 'purchase',
  calc_type: 'percentage',
  calc_value: '10',
  priority: '0',
  status: 'active',
};

const describeCalc = (r: EarnRule) => {
  if (r.calc_type === 'fixed') return `${r.calc_value} pts`;
  if (r.calc_type === 'percentage') return `${r.calc_value}%`;
  return `x${r.calc_value}`;
};

const LoyaltyRulesPage = () => {
  const { data: programsData } = useLoyaltyPrograms();
  const program = programsData?.programs?.find((p) => p.status === 'active') ?? programsData?.programs?.[0];
  const { data, isLoading } = useEarnRules(program ? { program_id: program.id } : undefined);
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const prompt = usePrompt();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RuleForm>(emptyForm);

  const set = <K extends keyof RuleForm>(key: K, value: RuleForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (r: EarnRule) => {
    setForm({
      id: r.id,
      name: r.name,
      event: r.event,
      calc_type: r.calc_type,
      calc_value: String(r.calc_value),
      priority: String(r.priority ?? 0),
      status: r.status,
    });
    setOpen(true);
  };

  const onSave = async () => {
    if (!program) return;
    const body = {
      program_id: program.id,
      name: form.name,
      event: form.event,
      calc_type: form.calc_type,
      calc_value: Number(form.calc_value) || 0,
      priority: Number(form.priority) || 0,
      status: form.status,
    };
    try {
      if (form.id) await updateRule.mutateAsync({ id: form.id, ...body });
      else await createRule.mutateAsync(body);
      toast.success('Regla guardada');
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (r: EarnRule) => {
    const ok = await prompt({
      title: 'Eliminar regla',
      description: `¿Eliminar la regla "${r.name}"?`,
    });
    if (!ok) return;
    try {
      await deleteRule.mutateAsync(r.id);
      toast.success('Regla eliminada');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const rules = data?.rules ?? [];

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Reglas de acumulación</Heading>
        <div className="flex items-center gap-3">
          <ExtensionVersion extension="loyalty" />
          <Button size="small" onClick={openCreate} disabled={!program}>
            Nueva regla
          </Button>
        </div>
      </div>
      <SiteScopeBar screen="loyalty/rules" />

      {!program && (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Creá el programa en Configuración antes de agregar reglas.</Text>
        </div>
      )}

      {program && (
        <div className="px-6 py-4">
          {isLoading ? (
            <Text className="text-ui-fg-subtle">Cargando…</Text>
          ) : rules.length === 0 ? (
            <Text className="text-ui-fg-subtle">No hay reglas todavía.</Text>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Nombre</Table.HeaderCell>
                  <Table.HeaderCell>Evento</Table.HeaderCell>
                  <Table.HeaderCell>Cálculo</Table.HeaderCell>
                  <Table.HeaderCell>Prioridad</Table.HeaderCell>
                  <Table.HeaderCell>Estado</Table.HeaderCell>
                  <Table.HeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rules.map((r) => (
                  <Table.Row key={r.id}>
                    <Table.Cell>{r.name}</Table.Cell>
                    <Table.Cell>{EVENT_LABELS[r.event]}</Table.Cell>
                    <Table.Cell>
                      {CALC_LABELS[r.calc_type]} · {describeCalc(r)}
                    </Table.Cell>
                    <Table.Cell>{r.priority}</Table.Cell>
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
            <Drawer.Title>{form.id ? 'Editar regla' : 'Nueva regla'}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label size="small">Nombre</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small">Evento</Label>
              <Select value={form.event} onValueChange={(v) => set('event', v as RuleForm['event'])}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content className="z-[60]">
                  {Object.entries(EVENT_LABELS).map(([value, label]) => (
                    <Select.Item key={value} value={value}>
                      {label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label size="small">Tipo de cálculo</Label>
                <Select value={form.calc_type} onValueChange={(v) => set('calc_type', v as RuleForm['calc_type'])}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content className="z-[60]">
                    {Object.entries(CALC_LABELS).map(([value, label]) => (
                      <Select.Item key={value} value={value}>
                        {label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">Valor</Label>
                <Input
                  type="number"
                  value={form.calc_value}
                  onChange={(e) => set('calc_value', e.target.value)}
                />
              </div>
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              {form.calc_type === 'fixed' && 'Puntos fijos otorgados.'}
              {form.calc_type === 'percentage' && 'Porcentaje del monto elegible (10 = 10% ≈ 1 punto por $10).'}
              {form.calc_type === 'multiplier' && 'Puntos por unidad de moneda (1 = 1 punto por $1).'}
            </Text>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label size="small">Prioridad</Label>
                <Input type="number" value={form.priority} onChange={(e) => set('priority', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="small">Estado</Label>
                <Select value={form.status} onValueChange={(v) => set('status', v as RuleForm['status'])}>
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
            <Button onClick={onSave} isLoading={createRule.isPending || updateRule.isPending}>
              Guardar
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'Reglas',
});

export const handle = {
  breadcrumb: () => 'Reglas',
};

export default LoyaltyRulesPage;
