import { defineRouteConfig } from '@medusajs/admin-sdk';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Badge,
  Button,
  Container,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  Label,
  Prompt,
  Select,
  Switch,
  Table,
  Text,
  toast,
  Toaster,
} from '@medusajs/ui';
import { EllipsisHorizontal, Plus, Trash } from '@medusajs/icons';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  type AssignStrategy,
  type DeliveryProviderType,
  type DeliveryRule,
  type RuleAction,
  type RuleField,
  type RouteStrategy,
  type RuleOperator,
  type RulePredicate,
  type RulePredicateValue,
  useCreateRule,
  useDeleteRule,
  useRules,
  useUpdateRule,
  useZones,
} from '../../../hooks/api/delivery';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';

const PAGE_SIZE = 20;

// Sentinel "Global" (zona null) para el Select (UI Select no admite value="").
const GLOBAL_ZONE = '__global';
// Sentinel "sin valor" para los Selects opcionales de la acción.
const NO_VALUE = '__none';

const FIELD_LABELS: Record<RuleField, string> = {
  weight_kg: 'Peso (kg)',
  order_total: 'Total de la orden',
  item_count: 'Cantidad de ítems',
  sku: 'SKU',
  skus: 'SKUs',
  postal_code: 'Código postal',
  time_of_day: 'Hora del día (HH:mm)',
  zone_id: 'Zona',
  pricing_tier: 'Pricing tier',
  temperature: 'Temperatura',
};
const FIELD_VALUES = Object.keys(FIELD_LABELS) as RuleField[];

// Modos de temperatura para el value del campo 'temperature'.
const TEMPERATURE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ambient', label: 'Ambiente' },
  { value: 'refrigerated', label: 'Refrigerado' },
  { value: 'frozen', label: 'Congelado' },
];

// Estrategias de asignación automática de flota propia (F5/F7).
const STRATEGY_ASSIGN_LABELS: Record<AssignStrategy, string> = {
  round_robin: 'Round-robin',
  first_available: 'Primer disponible',
  least_load: 'Menor carga',
};
const STRATEGY_ASSIGN_VALUES = Object.keys(
  STRATEGY_ASSIGN_LABELS,
) as AssignStrategy[];

const OP_LABELS: Record<RuleOperator, string> = {
  eq: '= igual',
  neq: '≠ distinto',
  gt: '> mayor',
  gte: '≥ mayor o igual',
  lt: '< menor',
  lte: '≤ menor o igual',
  in: 'en lista',
  nin: 'no en lista',
  between: 'entre',
  contains: 'contiene',
};
const OP_VALUES = Object.keys(OP_LABELS) as RuleOperator[];

const PROVIDER_LABELS: Record<DeliveryProviderType, string> = {
  andreani: 'Andreani',
  own_fleet: 'Flota propia',
  store_pickup: 'Retiro en tienda',
};
const PROVIDER_VALUES = Object.keys(PROVIDER_LABELS) as DeliveryProviderType[];

const STRATEGY_LABELS: Record<RouteStrategy, string> = {
  auto: 'Automática',
  manual: 'Manual',
  optimized: 'Optimizada',
};
const STRATEGY_VALUES = Object.keys(STRATEGY_LABELS) as RouteStrategy[];

// Operadores cuyo lado derecho es una LISTA (value = array).
const LIST_OPS: RuleOperator[] = ['in', 'nin'];
// Operadores con DOS valores (value = [min, max]).
const RANGE_OPS: RuleOperator[] = ['between'];

// ── Serialización de value ───────────────────────────────────────────────────
//
// En el form cada condición guarda strings (valueA, valueB). Al enviar al
// backend convertimos al shape JSON que espera el motor de reglas (types.ts):
//   - in/nin  → array (split por comas, cada token coercido)
//   - between → [valueA, valueB] (ambos coercidos)
//   - resto   → escalar coercido
// Coerción: 'true'/'false' → boolean; numérico puro → number; sino string.
// time_of_day ('HH:mm') queda string porque no es numérico puro.

const coerceScalar = (raw: string): string | number | boolean => {
  const t = raw.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t !== '' && !Number.isNaN(Number(t))) return Number(t);
  return t;
};

const coerceList = (raw: string): Array<string | number> =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const n = Number(s);
      return !Number.isNaN(n) && s !== '' ? n : s;
    });

const buildValue = (
  op: RuleOperator,
  valueA: string,
  valueB: string,
): RulePredicateValue => {
  if (LIST_OPS.includes(op)) return coerceList(valueA);
  if (RANGE_OPS.includes(op)) return [coerceScalar(valueA), coerceScalar(valueB)];
  return coerceScalar(valueA);
};

// ── Deserialización (persisted value → strings del form) ─────────────────────

const splitValue = (
  op: RuleOperator,
  value: RulePredicateValue,
): { valueA: string; valueB: string } => {
  if (RANGE_OPS.includes(op) && Array.isArray(value)) {
    return {
      valueA: value[0] != null ? String(value[0]) : '',
      valueB: value[1] != null ? String(value[1]) : '',
    };
  }
  if (LIST_OPS.includes(op) && Array.isArray(value)) {
    return { valueA: value.join(', '), valueB: '' };
  }
  return { valueA: value != null ? String(value) : '', valueB: '' };
};

// ── Resumen de la acción para la tabla (ej. "→ own_fleet · +$500") ───────────

const summarizeAction = (action: RuleAction): string => {
  const parts: string[] = [];
  if (action.assign_provider)
    parts.push(`→ ${PROVIDER_LABELS[action.assign_provider] ?? action.assign_provider}`);
  if (action.service_mode) parts.push(action.service_mode);
  if (action.route_strategy)
    parts.push(STRATEGY_LABELS[action.route_strategy] ?? action.route_strategy);
  if (action.surcharge != null && action.surcharge > 0)
    parts.push(`+$${action.surcharge}`);
  if (action.assign_strategy)
    parts.push(
      STRATEGY_ASSIGN_LABELS[action.assign_strategy] ?? action.assign_strategy,
    );
  if (action.auto_assign) parts.push('auto-asignar');
  return parts.length ? parts.join(' · ') : '—';
};

// ── Schema del form ──────────────────────────────────────────────────────────

const conditionSchema = z.object({
  field: z.enum([
    'weight_kg',
    'order_total',
    'item_count',
    'sku',
    'skus',
    'postal_code',
    'time_of_day',
    'zone_id',
    'pricing_tier',
    'temperature',
  ]),
  op: z.enum([
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'nin',
    'between',
    'contains',
  ]),
  valueA: z.string().min(1, 'Requerido'),
  valueB: z.string().optional(),
});

const ruleFormSchema = z
  .object({
    name: z.string().min(1, 'El nombre es obligatorio'),
    delivery_zone_id: z.string(),
    priority: z.string().optional(),
    conditions: z.array(conditionSchema),
    assign_provider: z.string(),
    route_strategy: z.string(),
    surcharge: z.string().optional(),
    assign_strategy: z.string(),
    auto_assign: z.boolean(),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    // El backend exige que la acción tenga al menos un efecto.
    const hasProvider = v.assign_provider !== NO_VALUE;
    const hasStrategy = v.route_strategy !== NO_VALUE;
    const hasSurcharge = !!v.surcharge && Number(v.surcharge) > 0;
    const hasAssignStrategy = v.assign_strategy !== NO_VALUE;
    const hasAutoAssign = v.auto_assign;
    if (
      !hasProvider &&
      !hasStrategy &&
      !hasSurcharge &&
      !hasAssignStrategy &&
      !hasAutoAssign
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'La acción debe definir al menos un efecto (provider, ruteo, recargo, estrategia de asignación o auto-asignar).',
        path: ['assign_provider'],
      });
    }
    // between requiere ambos extremos.
    v.conditions.forEach((c, i) => {
      if (RANGE_OPS.includes(c.op) && (!c.valueB || !c.valueB.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Indicá el segundo valor del rango.',
          path: ['conditions', i, 'valueB'],
        });
      }
    });
  });

type RuleFormValues = z.infer<typeof ruleFormSchema>;

const emptyForm: RuleFormValues = {
  name: '',
  delivery_zone_id: GLOBAL_ZONE,
  priority: '0',
  conditions: [],
  assign_provider: NO_VALUE,
  route_strategy: NO_VALUE,
  surcharge: '',
  assign_strategy: NO_VALUE,
  auto_assign: false,
  active: true,
};

const toInt = (raw?: string): number => {
  if (!raw || !raw.trim()) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

const RuleFormDrawer = ({
  open,
  onClose,
  rule,
}: {
  open: boolean;
  onClose: () => void;
  rule: DeliveryRule | null;
}) => {
  const isEdit = !!rule;
  const { data: zoneData } = useZones({ limit: 200 });
  const zones = zoneData?.zones ?? [];

  const create = useCreateRule();
  const update = useUpdateRule(rule?.id ?? '');
  const isPending = create.isPending || update.isPending;

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: emptyForm,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'conditions',
  });

  useEffect(() => {
    if (open) {
      reset(
        rule
          ? {
              name: rule.name,
              delivery_zone_id: rule.delivery_zone_id ?? GLOBAL_ZONE,
              priority: String(rule.priority ?? 0),
              conditions: (rule.conditions ?? []).map((c) => {
                const { valueA, valueB } = splitValue(c.op, c.value);
                return { field: c.field, op: c.op, valueA, valueB };
              }),
              assign_provider: rule.action?.assign_provider ?? NO_VALUE,
              route_strategy: rule.action?.route_strategy ?? NO_VALUE,
              surcharge:
                rule.action?.surcharge != null
                  ? String(rule.action.surcharge)
                  : '',
              assign_strategy: rule.action?.assign_strategy ?? NO_VALUE,
              auto_assign: rule.action?.auto_assign ?? false,
              active: rule.active ?? true,
            }
          : emptyForm,
      );
    }
  }, [open, rule, reset]);

  const onSubmit = handleSubmit((values) => {
    const conditions: RulePredicate[] = values.conditions.map((c) => ({
      field: c.field,
      op: c.op,
      value: buildValue(c.op, c.valueA, c.valueB ?? ''),
    }));

    const action: RuleAction = {};
    if (values.assign_provider !== NO_VALUE)
      action.assign_provider = values.assign_provider as DeliveryProviderType;
    if (values.route_strategy !== NO_VALUE)
      action.route_strategy = values.route_strategy as RouteStrategy;
    const surcharge = values.surcharge ? Number(values.surcharge) : 0;
    if (Number.isFinite(surcharge) && surcharge > 0)
      action.surcharge = Math.trunc(surcharge);
    if (values.assign_strategy !== NO_VALUE)
      action.assign_strategy = values.assign_strategy as AssignStrategy;
    if (values.auto_assign) action.auto_assign = true;

    const payload = {
      name: values.name.trim(),
      delivery_zone_id:
        values.delivery_zone_id === GLOBAL_ZONE
          ? null
          : values.delivery_zone_id,
      priority: toInt(values.priority),
      conditions,
      action,
      active: values.active,
    };

    const onSuccess = () => {
      toast.success(isEdit ? 'Regla actualizada' : 'Regla creada');
      onClose();
    };
    const onError = (e: unknown) => toast.error((e as Error).message);

    if (isEdit) {
      update.mutate(payload, { onSuccess, onError });
    } else {
      create.mutate(payload, { onSuccess, onError });
    }
  });

  const conditionErrors = errors.conditions;

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content className="z-50">
        <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
          <Drawer.Header>
            <Drawer.Title>
              {isEdit ? 'Editar regla' : 'Nueva regla'}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-4 overflow-y-auto">
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus">
                    Nombre
                  </Label>
                  <Input
                    {...field}
                    placeholder="Pedidos pesados → flota propia"
                    disabled={isPending}
                  />
                  {errors.name ? (
                    <Text size="xsmall" className="text-ui-fg-error">
                      {errors.name.message}
                    </Text>
                  ) : null}
                </div>
              )}
            />
            <div className="grid grid-cols-2 gap-2">
              <Controller
                control={control}
                name="delivery_zone_id"
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <Label size="small" weight="plus">
                      Zona
                    </Label>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isPending}
                    >
                      <Select.Trigger>
                        <Select.Value placeholder="Global" />
                      </Select.Trigger>
                      <Select.Content className="z-[60]">
                        <Select.Item value={GLOBAL_ZONE}>
                          Global (todas)
                        </Select.Item>
                        {zones.map((z) => (
                          <Select.Item key={z.id} value={z.id}>
                            {z.name}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                )}
              />
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <Label size="small" weight="plus">
                      Prioridad
                    </Label>
                    <Input
                      {...field}
                      type="number"
                      placeholder="0"
                      disabled={isPending}
                    />
                  </div>
                )}
              />
            </div>

            {/* ── Editor de condiciones ── */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label size="small" weight="plus">
                  Condiciones
                </Label>
                <Button
                  size="small"
                  variant="secondary"
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    append({
                      field: 'order_total',
                      op: 'gte',
                      valueA: '',
                      valueB: '',
                    })
                  }
                >
                  <Plus />
                  Agregar
                </Button>
              </div>
              {fields.length === 0 ? (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Sin condiciones: la regla aplica siempre (dentro de su zona).
                </Text>
              ) : null}
              {fields.map((row, index) => {
                const op = watch(`conditions.${index}.op`);
                const fieldValue = watch(`conditions.${index}.field`);
                const isRange = RANGE_OPS.includes(op);
                const isList = LIST_OPS.includes(op);
                const isTemperature = fieldValue === 'temperature';
                const rowErr = conditionErrors?.[index];
                return (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-3"
                  >
                    <div className="flex items-start gap-2">
                      <Controller
                        control={control}
                        name={`conditions.${index}.field`}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isPending}
                          >
                            <Select.Trigger className="flex-1">
                              <Select.Value placeholder="Campo" />
                            </Select.Trigger>
                            <Select.Content className="z-[60]">
                              {FIELD_VALUES.map((f) => (
                                <Select.Item key={f} value={f}>
                                  {FIELD_LABELS[f]}
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select>
                        )}
                      />
                      <Controller
                        control={control}
                        name={`conditions.${index}.op`}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isPending}
                          >
                            <Select.Trigger className="w-[150px]">
                              <Select.Value placeholder="Operador" />
                            </Select.Trigger>
                            <Select.Content className="z-[60]">
                              {OP_VALUES.map((o) => (
                                <Select.Item key={o} value={o}>
                                  {OP_LABELS[o]}
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select>
                        )}
                      />
                      <IconButton
                        type="button"
                        variant="transparent"
                        disabled={isPending}
                        onClick={() => remove(index)}
                      >
                        <Trash />
                      </IconButton>
                    </div>
                    <div className="flex items-start gap-2">
                      <Controller
                        control={control}
                        name={`conditions.${index}.valueA`}
                        render={({ field }) => (
                          <div className="flex flex-1 flex-col gap-1">
                            {isTemperature && !isList ? (
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={isPending}
                              >
                                <Select.Trigger>
                                  <Select.Value placeholder="Temperatura" />
                                </Select.Trigger>
                                <Select.Content className="z-[60]">
                                  {TEMPERATURE_OPTIONS.map((t) => (
                                    <Select.Item key={t.value} value={t.value}>
                                      {t.label}
                                    </Select.Item>
                                  ))}
                                </Select.Content>
                              </Select>
                            ) : (
                              <Input
                                {...field}
                                placeholder={
                                  isTemperature
                                    ? 'ej. refrigerated, frozen'
                                    : isList
                                      ? 'valores separados por coma'
                                      : isRange
                                        ? 'desde'
                                        : 'valor'
                                }
                                disabled={isPending}
                              />
                            )}
                            {rowErr?.valueA ? (
                              <Text size="xsmall" className="text-ui-fg-error">
                                {rowErr.valueA.message}
                              </Text>
                            ) : null}
                          </div>
                        )}
                      />
                      {isRange ? (
                        <Controller
                          control={control}
                          name={`conditions.${index}.valueB`}
                          render={({ field }) => (
                            <div className="flex flex-1 flex-col gap-1">
                              <Input
                                {...field}
                                placeholder="hasta"
                                disabled={isPending}
                              />
                              {rowErr?.valueB ? (
                                <Text
                                  size="xsmall"
                                  className="text-ui-fg-error"
                                >
                                  {rowErr.valueB.message}
                                </Text>
                              ) : null}
                            </div>
                          )}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Acción ── */}
            <div className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-3">
              <Label size="small" weight="plus">
                Acción
              </Label>
              <Controller
                control={control}
                name="assign_provider"
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <Label size="xsmall" className="text-ui-fg-subtle">
                      Asignar provider
                    </Label>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isPending}
                    >
                      <Select.Trigger>
                        <Select.Value placeholder="Sin cambio" />
                      </Select.Trigger>
                      <Select.Content className="z-[60]">
                        <Select.Item value={NO_VALUE}>Sin cambio</Select.Item>
                        {PROVIDER_VALUES.map((p) => (
                          <Select.Item key={p} value={p}>
                            {PROVIDER_LABELS[p]}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                )}
              />
              <Controller
                control={control}
                name="route_strategy"
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <Label size="xsmall" className="text-ui-fg-subtle">
                      Estrategia de ruteo
                    </Label>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isPending}
                    >
                      <Select.Trigger>
                        <Select.Value placeholder="Sin cambio" />
                      </Select.Trigger>
                      <Select.Content className="z-[60]">
                        <Select.Item value={NO_VALUE}>Sin cambio</Select.Item>
                        {STRATEGY_VALUES.map((s) => (
                          <Select.Item key={s} value={s}>
                            {STRATEGY_LABELS[s]}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                )}
              />
              <Controller
                control={control}
                name="surcharge"
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <Label size="xsmall" className="text-ui-fg-subtle">
                      Recargo (menor unidad monetaria)
                    </Label>
                    <Input
                      {...field}
                      type="number"
                      min={0}
                      placeholder="0"
                      disabled={isPending}
                    />
                  </div>
                )}
              />
              <Controller
                control={control}
                name="assign_strategy"
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <Label size="xsmall" className="text-ui-fg-subtle">
                      Estrategia de asignación (flota propia)
                    </Label>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isPending}
                    >
                      <Select.Trigger>
                        <Select.Value placeholder="Sin cambio" />
                      </Select.Trigger>
                      <Select.Content className="z-[60]">
                        <Select.Item value={NO_VALUE}>Sin cambio</Select.Item>
                        {STRATEGY_ASSIGN_VALUES.map((s) => (
                          <Select.Item key={s} value={s}>
                            {STRATEGY_ASSIGN_LABELS[s]}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                )}
              />
              <Controller
                control={control}
                name="auto_assign"
                render={({ field }) => (
                  <div className="flex items-center justify-between">
                    <Label size="xsmall" className="text-ui-fg-subtle">
                      Auto-asignar al cumplirse la regla
                    </Label>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isPending}
                    />
                  </div>
                )}
              />
              {errors.assign_provider ? (
                <Text size="xsmall" className="text-ui-fg-error">
                  {errors.assign_provider.message}
                </Text>
              ) : null}
            </div>

            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <div className="flex items-center justify-between">
                  <Label size="small" weight="plus">
                    Activa
                  </Label>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isPending}
                  />
                </div>
              )}
            />
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={isPending}>
              {isEdit ? 'Guardar' : 'Crear'}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  );
};

const RulesPage = () => {
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryRule | null>(null);
  const [toDelete, setToDelete] = useState<DeliveryRule | null>(null);

  const { data, isLoading } = useRules({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    delivery_zone_id: zoneFilter === 'all' ? undefined : zoneFilter,
  });
  const { data: zoneData } = useZones({ limit: 200 });
  const deleteRule = useDeleteRule();

  const rules = data?.rules ?? [];
  const count = data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const zoneNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const z of zoneData?.zones ?? []) map.set(z.id, z.name);
    return map;
  }, [zoneData]);

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (r: DeliveryRule) => {
    setEditing(r);
    setDrawerOpen(true);
  };

  const onConfirmDelete = () => {
    if (!toDelete) return;
    deleteRule.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success('Regla eliminada');
        setToDelete(null);
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    <>
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-x-2">
            <Heading>Reglas</Heading>
            <ExtensionVersion extension="delivery" />
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={zoneFilter}
              onValueChange={(v) => {
                setZoneFilter(v);
                setPage(0);
              }}
            >
              <Select.Trigger className="w-[200px]">
                <Select.Value placeholder="Zona" />
              </Select.Trigger>
              <Select.Content className="z-[60]">
                <Select.Item value="all">Todas las zonas</Select.Item>
                {(zoneData?.zones ?? []).map((z) => (
                  <Select.Item key={z.id} value={z.id}>
                    {z.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Button size="small" variant="primary" onClick={openCreate}>
              Nueva regla
            </Button>
          </div>
        </div>

        {/*
          `scoped`: `admin/delivery/rules` mete el filtro en el WHERE (`siteFilter(…,
          DELIVERY_RULE_SITE_SCOPE)`, `api/admin/delivery/rules/route.ts:26`) y `[id]`
          corre `assertIdInSite`. La regla cuelga de la ZONA y la zona de la sucursal:
          dos saltos de `via_parent`, no una columna propia.

          El descriptor es `empty: 'global'`, así que la regla con `delivery_zone_id
          NULL` —la que aplica a todas las zonas— se sigue listando en todas las
          tiendas. Es lo correcto: es la que efectivamente rige cuando la zona no tiene
          la suya.
        */}
        <SiteScopeBar screen="delivery.rules" />

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Nombre</Table.HeaderCell>
              <Table.HeaderCell>Zona</Table.HeaderCell>
              <Table.HeaderCell>Prioridad</Table.HeaderCell>
              <Table.HeaderCell>Condiciones</Table.HeaderCell>
              <Table.HeaderCell>Acción</Table.HeaderCell>
              <Table.HeaderCell>Activa</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <Table.Cell colSpan={7}>Cargando…</Table.Cell>
              </Table.Row>
            ) : rules.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={7}>No hay reglas todavía.</Table.Cell>
              </Table.Row>
            ) : (
              rules.map((r) => (
                <Table.Row
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => openEdit(r)}
                >
                  <Table.Cell>
                    <Text size="small" weight="plus">
                      {r.name}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    {r.delivery_zone_id ? (
                      (zoneNameById.get(r.delivery_zone_id) ??
                      r.delivery_zone_id)
                    ) : (
                      <Badge size="2xsmall" color="grey">
                        Global
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>{r.priority}</Table.Cell>
                  <Table.Cell>
                    <Text size="small">
                      {r.conditions?.length ?? 0}{' '}
                      {(r.conditions?.length ?? 0) === 1
                        ? 'condición'
                        : 'condiciones'}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {summarizeAction(r.action ?? {})}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <RuleActiveToggle rule={r} />
                  </Table.Cell>
                  <Table.Cell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <IconButton variant="transparent">
                            <EllipsisHorizontal />
                          </IconButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content align="end">
                          <DropdownMenu.Item onClick={() => openEdit(r)}>
                            Editar
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            className="text-ui-fg-error"
                            onClick={() => setToDelete(r)}
                          >
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

        <div className="flex items-center justify-between px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            {count} reglas · Página {page + 1} de {pageCount}
          </Text>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </Container>

      <RuleFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        rule={editing}
      />

      <Prompt open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Eliminar regla</Prompt.Title>
            <Prompt.Description>
              ¿Seguro que querés eliminar la regla {toDelete?.name}? Esta acción
              no se puede deshacer.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action
              onClick={onConfirmDelete}
              disabled={deleteRule.isPending}
            >
              Eliminar
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>

      <Toaster />
    </>
  );
};

// Toggle activa/inactiva por fila (cada uno con su mutación scopeada al id).
const RuleActiveToggle = ({ rule }: { rule: DeliveryRule }) => {
  const update = useUpdateRule(rule.id);
  return (
    <Switch
      checked={rule.active ?? true}
      disabled={update.isPending}
      onClick={(e) => e.stopPropagation()}
      onCheckedChange={(checked) =>
        update.mutate(
          { active: checked },
          {
            onSuccess: () =>
              toast.success(checked ? 'Regla activada' : 'Regla desactivada'),
            onError: (err) => toast.error((err as Error).message),
          },
        )
      }
    />
  );
};

export const config = defineRouteConfig({
  label: 'Reglas',
});

export default RulesPage;
