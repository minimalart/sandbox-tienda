import { Plus, Trash } from '@medusajs/icons';
import {
  Button,
  FocusModal,
  IconButton,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Textarea,
  toast,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import {
  type Condition,
  type ConditionOperator,
  type DynamicGroup,
  useCreateDynamicGroup,
  useUpdateDynamicGroup,
} from '../../../hooks/api/dynamic-groups';

type FieldKind = 'number' | 'text' | 'boolean';

const FIELDS: Array<{
  value: string;
  label: string;
  kind: FieldKind;
  windowed?: boolean;
}> = [
  { value: 'orders_count', label: 'Cantidad de compras', kind: 'number' },
  { value: 'total_spend', label: 'Gasto total ($)', kind: 'number' },
  { value: 'spend_last_days', label: 'Gasto en últimos N días ($)', kind: 'number', windowed: true },
  { value: 'orders_last_days', label: 'Compras en últimos N días', kind: 'number', windowed: true },
  { value: 'days_since_last_order', label: 'Días sin comprar', kind: 'number' },
  { value: 'aov', label: 'Ticket promedio ($)', kind: 'number' },
  { value: 'province', label: 'Provincia (ej. CABA)', kind: 'text' },
  { value: 'country', label: 'País (código, ej. ar)', kind: 'text' },
  { value: 'is_wholesale', label: 'Es mayorista', kind: 'boolean' },
  { value: 'registered_no_purchase', label: 'Registrado sin compra', kind: 'boolean' },
  { value: 'account_age_days', label: 'Antigüedad de la cuenta (días)', kind: 'number' },
  { value: 'birthday_this_month', label: 'Cumpleaños este mes', kind: 'boolean' },
];

const OPERATORS: Array<{ value: ConditionOperator; label: string }> = [
  { value: 'gte', label: '≥ mayor o igual' },
  { value: 'lte', label: '≤ menor o igual' },
  { value: 'eq', label: '= igual' },
  { value: 'neq', label: '≠ distinto' },
  { value: 'in', label: 'en lista (coma)' },
  { value: 'contains', label: 'contiene' },
];

const fieldKind = (field: string): FieldKind =>
  FIELDS.find((f) => f.value === field)?.kind ?? 'text';
const isWindowed = (field: string): boolean =>
  !!FIELDS.find((f) => f.value === field)?.windowed;

type Row = { field: string; operator: ConditionOperator; value: string; days: string };

const emptyRow = (): Row => ({
  field: 'orders_count',
  operator: 'gte',
  value: '',
  days: '',
});

const toRow = (c: Condition): Row => ({
  field: c.field,
  operator: c.operator,
  value: Array.isArray(c.value) ? c.value.join(', ') : String(c.value ?? ''),
  days: c.days != null ? String(c.days) : '',
});

function rowToCondition(r: Row): Condition {
  const kind = fieldKind(r.field);
  let value: Condition['value'];
  if (r.operator === 'in') {
    value = r.value.split(',').map((v) => v.trim()).filter(Boolean);
  } else if (kind === 'number') {
    value = Number(r.value) || 0;
  } else if (kind === 'boolean') {
    value = r.value === 'true';
  } else {
    value = r.value;
  }
  const cond: Condition = { field: r.field, operator: r.operator, value };
  if (isWindowed(r.field) && r.days) cond.days = Number(r.days) || undefined;
  return cond;
}

type Props = { open: boolean; onClose: () => void; group?: DynamicGroup | null };

export const DynamicGroupForm = ({ open, onClose, group }: Props) => {
  const isEdit = !!group;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [match, setMatch] = useState<'all' | 'any'>('all');
  const [updateMode, setUpdateMode] = useState<'realtime' | 'manual'>('realtime');
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  const createMut = useCreateDynamicGroup();
  const updateMut = useUpdateDynamicGroup(group?.id ?? '');
  const isPending = createMut.isPending || updateMut.isPending;

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? '');
    setDescription(group?.description ?? '');
    setIsActive(group?.is_active ?? true);
    setMatch(group?.match ?? 'all');
    setUpdateMode(group?.update_mode ?? 'realtime');
    setRows(
      group?.conditions?.length ? group.conditions.map(toRow) : [emptyRow()],
    );
  }, [open, group]);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (i: number) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));

  const submit = async () => {
    if (name.trim().length < 2) {
      toast.error('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    const conditions = rows
      .filter((r) => r.field)
      .map(rowToCondition);
    const body = {
      name: name.trim(),
      description: description || null,
      is_active: isActive,
      match,
      update_mode: updateMode,
      conditions,
    };
    try {
      if (isEdit) {
        await updateMut.mutateAsync(body);
        toast.success('Grupo actualizado');
      } else {
        await createMut.mutateAsync(body);
        toast.success('Grupo creado');
      }
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <FocusModal open={open} onOpenChange={(v) => !v && onClose()}>
      <FocusModal.Content>
        <FocusModal.Header>
          <Button size="small" onClick={submit} isLoading={isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear grupo'}
          </Button>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-8">
          <div className="flex w-full max-w-2xl flex-col gap-6">
            <div>
              <Text size="large" weight="plus">
                {isEdit ? 'Editar grupo dinámico' : 'Nuevo grupo dinámico'}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                Un grupo es una regla viva: los clientes entran/salen
                automáticamente según las condiciones.
              </Text>
            </div>

            <div className="flex flex-col gap-2">
              <Label size="small">Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Clientes VIP" />
            </div>

            <div className="flex flex-col gap-2">
              <Label size="small">Descripción (opcional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-ui-border-base p-3">
              <div>
                <Label size="small">Activo</Label>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Los grupos inactivos no se evalúan.
                </Text>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label size="small">Coincidencia</Label>
                <Select value={match} onValueChange={(v) => setMatch(v as 'all' | 'any')}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="all">Cumple TODAS las condiciones</Select.Item>
                    <Select.Item value="any">Cumple ALGUNA condición</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label size="small">Actualización</Label>
                <Select value={updateMode} onValueChange={(v) => setUpdateMode(v as 'realtime' | 'manual')}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="realtime">Tiempo real (eventos)</Select.Item>
                    <Select.Item value="manual">Manual</Select.Item>
                  </Select.Content>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Label size="small">Condiciones</Label>
              {rows.map((r, i) => {
                const kind = fieldKind(r.field);
                return (
                  <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-ui-border-base p-3">
                    <div className="flex min-w-[180px] flex-1 flex-col gap-1">
                      <Label size="xsmall">Campo</Label>
                      <Select value={r.field} onValueChange={(v) => setRow(i, { field: v })}>
                        <Select.Trigger><Select.Value /></Select.Trigger>
                        <Select.Content>
                          {FIELDS.map((f) => (
                            <Select.Item key={f.value} value={f.value}>{f.label}</Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </div>
                    <div className="flex w-[150px] flex-col gap-1">
                      <Label size="xsmall">Operador</Label>
                      <Select value={r.operator} onValueChange={(v) => setRow(i, { operator: v as ConditionOperator })}>
                        <Select.Trigger><Select.Value /></Select.Trigger>
                        <Select.Content>
                          {OPERATORS.map((o) => (
                            <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </div>
                    {isWindowed(r.field) && (
                      <div className="flex w-[90px] flex-col gap-1">
                        <Label size="xsmall">Días</Label>
                        <Input type="number" value={r.days} onChange={(e) => setRow(i, { days: e.target.value })} placeholder="90" />
                      </div>
                    )}
                    <div className="flex w-[140px] flex-col gap-1">
                      <Label size="xsmall">Valor</Label>
                      {kind === 'boolean' ? (
                        <Select value={r.value || 'true'} onValueChange={(v) => setRow(i, { value: v })}>
                          <Select.Trigger><Select.Value /></Select.Trigger>
                          <Select.Content>
                            <Select.Item value="true">Sí</Select.Item>
                            <Select.Item value="false">No</Select.Item>
                          </Select.Content>
                        </Select>
                      ) : (
                        <Input
                          type={kind === 'number' && r.operator !== 'in' ? 'number' : 'text'}
                          value={r.value}
                          onChange={(e) => setRow(i, { value: e.target.value })}
                        />
                      )}
                    </div>
                    <IconButton variant="transparent" onClick={() => removeRow(i)} type="button">
                      <Trash />
                    </IconButton>
                  </div>
                );
              })}
              <Button variant="secondary" size="small" onClick={addRow} type="button">
                <Plus /> Agregar condición
              </Button>
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  );
};

export default DynamicGroupForm;
