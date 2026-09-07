import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Buildings, ChevronLeftMini, ChevronRightMini, EllipsisHorizontal } from '@medusajs/icons';
import type { ReactNode } from 'react';
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
  Select,
  StatusBadge,
  Table,
  Text,
  toast,
  Toaster,
  usePrompt,
} from '@medusajs/ui';
import { useEffect, useRef, useState } from 'react';
import {
  type Company,
  type CompanyRole,
  useAddCompanyMember,
  useCompanies,
  useCompany,
  useCompanyCustomerGroup,
  useCreateCompany,
  useCustomerGroups,
  useDeleteCompany,
  useDeleteCompanyMember,
  useSalesChannels,
  useUpdateCompany,
  useUpdateCompanyMember,
} from '../../hooks/api/companies';
import {
  type CreditAccountStatus,
  useCompanyCredit,
  useCompanyCreditTransactions,
  useCreateCreditAccount,
  useCreateCreditTransaction,
  useUpdateCreditConditions,
} from '../../hooks/api/company-credit';
import { ExtensionVersion } from '../../components/common/extension-version';
import { HelpDrawer } from '../../components/common/help-drawer';
import { SiteScopeBar } from '../../components/common/site-scope-bar';
import { LogoUploader } from '../../components/common/logo-uploader';
import FiscalDocsTab from './components/fiscal-docs-tab';
import { useTranslation } from 'react-i18next';
import { LocationPicker, type PickedAddress } from '../store-locations/components/location-picker';
import { registerStoreLocationsTranslations } from '../../translations/store-locations';

const STATUS_COLOR: Record<string, 'green' | 'orange' | 'red' | 'grey'> = {
  active: 'green',
  pending: 'orange',
  suspended: 'red',
  archived: 'grey',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  pending: 'Pendiente',
  suspended: 'Suspendida',
  archived: 'Archivada',
};

type CompanyTab =
  | 'general'
  | 'commercial'
  | 'billing'
  | 'addresses'
  | 'rules'
  | 'credit'
  | 'users'
  | 'fiscal';

const COMPANY_TABS: Array<{ id: CompanyTab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'users', label: 'Usuarios' },
  { id: 'commercial', label: 'Comercial' },
  { id: 'billing', label: 'Facturación' },
  { id: 'fiscal', label: 'Documentación Fiscal' },
  { id: 'addresses', label: 'Direcciones' },
  { id: 'rules', label: 'Reglas' },
  { id: 'credit', label: 'Cuenta Corriente' },
];

type CompanyRuleType =
  | 'minimum_order_amount'
  | 'maximum_order_amount'
  | 'min_quantity_per_item';

type RuleScope = 'product' | 'tag' | 'category';

type CompanyRule = {
  id: string;
  type: CompanyRuleType;
  enabled: boolean;
  config: Record<string, unknown>;
};

const RULE_TYPE_LABELS: Record<CompanyRuleType, string> = {
  minimum_order_amount: 'Pedido mínimo ($)',
  maximum_order_amount: 'Pedido máximo ($)',
  min_quantity_per_item: 'Cantidad mínima por ítem',
};

const SCOPE_LABELS: Record<RuleScope, string> = {
  product: 'Producto (SKU)',
  tag: 'Etiqueta',
  category: 'Categoría',
};

const newRuleId = () => `rule_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function describeRule(r: CompanyRule): string {
  const c = r.config ?? {};
  if (r.type === 'minimum_order_amount') return `Pedido mínimo: $${Number(c.amount ?? 0).toLocaleString('es-AR')}`;
  if (r.type === 'maximum_order_amount') return `Pedido máximo: $${Number(c.amount ?? 0).toLocaleString('es-AR')}`;
  const scope = SCOPE_LABELS[(c.scope as RuleScope) ?? 'product'] ?? c.scope;
  return `Mínimo ${Number(c.min_qty ?? 0)} u. · ${scope}: «${String(c.target ?? '')}»`;
}

const TAX_CONDITIONS = [
  { value: 'responsable_inscripto', label: 'Responsable Inscripto' },
  { value: 'monotributo', label: 'Monotributo' },
  { value: 'exento', label: 'Exento' },
  { value: 'consumidor_final', label: 'Consumidor Final' },
];

type CompanyAddress = {
  id: string;
  label: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  province: string;
  postal_code: string;
  country_code?: string;
  phone?: string;
  contact_name?: string;
  lat?: string;
  lng?: string;
};

type CompanyBilling = {
  legal_name?: string;
  tax_id?: string;
  tax_condition?: string;
  document_type?: string;
  billing_email?: string;
  billing_phone?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country_code?: string;
};

const BILLING_DEFAULTS: CompanyBilling = {
  country_code: 'ar',
  tax_condition: 'responsable_inscripto',
  document_type: 'CUIT',
};

const newAddressId = () => `addr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Barra de tabs en UNA sola fila. Sin scrollbar visible: cuando hay tabs fuera
 *  de vista aparece una flecha (con degradado) a ese lado que scrollea hacia
 *  ahí, y al clickear un tab se centra. Así siempre se llega a todos (incluido
 *  el último) sin que quede oculto. */
function CompanyTabsBar({ tab, setTab }: { tab: CompanyTab; setTab: (t: CompanyTab) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    sync();
    const onResize = () => sync();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const nudge = (dir: -1 | 1) => ref.current?.scrollBy({ left: dir * 180, behavior: 'smooth' });

  return (
    <div className="relative mb-4 border-ui-border-base border-b">
      {canLeft ? (
        <button
          type="button"
          aria-label="Tabs anteriores"
          onClick={() => nudge(-1)}
          className="absolute inset-y-0 left-0 z-10 flex items-center bg-gradient-to-r from-ui-bg-base via-ui-bg-base to-transparent pr-6 text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
        >
          <ChevronLeftMini />
        </button>
      ) : null}
      <div
        ref={ref}
        onScroll={sync}
        className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {COMPANY_TABS.map((tDef) => (
          <button
            key={tDef.id}
            type="button"
            onClick={(e) => {
              setTab(tDef.id);
              e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm ${
              tab === tDef.id
                ? 'border-ui-fg-base border-b-2 font-medium text-ui-fg-base'
                : 'text-ui-fg-subtle'
            }`}
          >
            {tDef.label}
          </button>
        ))}
      </div>
      {canRight ? (
        <button
          type="button"
          aria-label="Tabs siguientes"
          onClick={() => nudge(1)}
          className="absolute inset-y-0 right-0 z-10 flex items-center bg-gradient-to-l from-ui-bg-base via-ui-bg-base to-transparent pl-6 text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
        >
          <ChevronRightMini />
        </button>
      ) : null}
    </div>
  );
}

const CompanyDetail = ({ company, onClose }: { company: Company | null; onClose: () => void }) => {
  const id = company?.id ?? '';
  const { data } = useCompany(id, !!company);
  const update = useUpdateCompany(id);
  const del = useDeleteCompany();
  const group = useCompanyCustomerGroup(id);
  const { data: groupsData, isLoading: loadingGroups } = useCustomerGroups();
  const groups = groupsData?.customer_groups ?? [];
  const { data: salesChannelsData } = useSalesChannels();
  const salesChannels = salesChannelsData?.sales_channels ?? [];
  const prompt = usePrompt();
  const [tab, setTab] = useState<CompanyTab>('general');
  const [form, setForm] = useState({
    name: '',
    legal_name: '',
    tax_id: '',
    sales_channel_id: '',
  });
  const [groupId, setGroupId] = useState('');
  const [billing, setBilling] = useState<CompanyBilling>(BILLING_DEFAULTS);

  useEffect(() => {
    if (data?.company) {
      setForm({
        name: data.company.name ?? '',
        legal_name: data.company.legal_name ?? '',
        tax_id: data.company.tax_id ?? '',
        sales_channel_id: data.company.sales_channel_id ?? '',
      });
      setBilling({
        ...BILLING_DEFAULTS,
        ...((data.company.metadata?.billing as CompanyBilling | undefined) ?? {}),
      });
    }
  }, [data]);

  const c = data?.company;
  const setBillingField = (k: keyof CompanyBilling, v: string) =>
    setBilling((p) => ({ ...p, [k]: v }));

  const saveBilling = async () => {
    try {
      await update.mutateAsync({
        metadata: { ...(c?.metadata ?? {}), billing } as Record<string, unknown>,
      });
      toast.success('Datos de facturación guardados');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const save = async () => {
    if (form.name.trim().length < 2) {
      toast.error('El nombre es obligatorio (mínimo 2 caracteres).');
      return;
    }
    try {
      await update.mutateAsync({
        name: form.name.trim(),
        legal_name: form.legal_name.trim() || null,
        tax_id: form.tax_id.trim() || null,
        sales_channel_id: form.sales_channel_id || null,
      });
      toast.success('Empresa actualizada');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async () => {
    const ok = await prompt({
      title: 'Eliminar empresa',
      description: `¿Eliminar "${company?.name}"? Se borran sus usuarios e invitaciones y se libera el customer group. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await del.mutateAsync(id);
      toast.success('Empresa eliminada');
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Drawer open={!!company} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content className="z-50">
        <Drawer.Header>
          <div className="flex items-center gap-2">
            <Heading>{company?.name}</Heading>
            {company ? (
              <StatusBadge color={STATUS_COLOR[company.status] ?? 'grey'}>{STATUS_LABELS[company.status] ?? company.status}</StatusBadge>
            ) : null}
          </div>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto overflow-x-hidden">
          <CompanyTabsBar tab={tab} setTab={setTab} />

          {!c ? (
            <Text className="text-ui-fg-subtle">Cargando…</Text>
          ) : tab === 'general' ? (
            <div className="flex flex-col gap-3">
              <Field label="Nombre">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Razón social">
                <Input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
              </Field>
              <Field label="CUIT / Tax ID">
                <Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
              </Field>
              <Field label="Sales channel (Wholesale)">
                <Select
                  value={form.sales_channel_id}
                  onValueChange={(v) => setForm({ ...form, sales_channel_id: v })}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Elegí un sales channel…" />
                  </Select.Trigger>
                  <Select.Content className="z-[60]">
                    {salesChannels.map((sc) => (
                      <Select.Item key={sc.id} value={sc.id}>{sc.name}</Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>
              <Field label="Logo de la empresa">
                <LogoUploader
                  value={(c.metadata as Record<string, unknown> | null)?.logo as string | undefined}
                  onChange={async (url) => {
                    try {
                      await update.mutateAsync({ metadata: { ...(c.metadata ?? {}), logo: url } });
                      toast.success(url ? 'Logo actualizado' : 'Logo quitado');
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                />
              </Field>
              {/* Acá había un párrafo que mandaba a las otras dos pestañas. Se va sin
                  reemplazo porque no perdía nada: las dos frases están escritas en la
                  pestaña que cada una nombra —«Vinculá un customer group…» abre Comercial
                  y «Datos fiscales de la empresa…» abre Facturación— y la barra de
                  pestañas las lista a un clic. Encima colgaba del último `Field`, así que
                  se leía como la ayuda del logo, que es de lo que no habla. El concepto
                  de fondo también está en el drawer, sección «Los precios mayoristas los
                  aplica el customer group» (`help/b2b.ts`). */}
              <div className="mt-2 border-ui-border-base border-t pt-3">
                <Text size="small" weight="plus" className="mb-1">Zona de peligro</Text>
                <Text size="xsmall" className="mb-2 text-ui-fg-subtle">
                  Eliminar la empresa borra sus usuarios e invitaciones y libera el customer group.
                </Text>
                <Button size="small" variant="danger" isLoading={del.isPending} onClick={onDelete}>
                  Eliminar empresa
                </Button>
              </div>
            </div>
          ) : tab === 'commercial' ? (
            <div className="flex flex-col gap-3">
              <Text size="small" className="text-ui-fg-subtle">
                Vinculá un customer group para aplicar precios mayoristas (price list) a esta empresa.
              </Text>
              {c.customer_group_id ? (
                <div className="flex items-center justify-between rounded-lg border border-ui-border-base p-3">
                  <div className="flex flex-col">
                    <Text size="xsmall" weight="plus">
                      {groups.find((g) => g.id === c.customer_group_id)?.name ?? 'Grupo vinculado'}
                    </Text>
                    <Text size="xsmall" className="font-mono text-ui-fg-subtle">{c.customer_group_id}</Text>
                  </div>
                  <Button size="small" variant="danger" isLoading={group.isPending} onClick={() => group.mutate({ action: 'unlink' })}>
                    Desvincular
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-3">
                  <Button size="small" isLoading={group.isPending} onClick={() => group.mutate({ action: 'link' })}>
                    Crear y vincular grupo nuevo
                  </Button>
                  <Text size="xsmall" className="text-ui-fg-subtle">o vincular uno existente:</Text>
                  {loadingGroups ? (
                    <Text size="xsmall" className="text-ui-fg-subtle">Cargando grupos…</Text>
                  ) : groups.length === 0 ? (
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      No hay customer groups todavía. Creá uno con el botón de arriba o desde Clientes → Grupos.
                    </Text>
                  ) : (
                    <div className="flex items-end gap-2">
                      <Select value={groupId} onValueChange={setGroupId}>
                        <Select.Trigger>
                          <Select.Value placeholder="Elegí un customer group…" />
                        </Select.Trigger>
                        <Select.Content className="z-[60]">
                          {groups.map((g) => (
                            <Select.Item key={g.id} value={g.id}>{g.name}</Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                      <Button size="small" variant="secondary" disabled={!groupId} onClick={() => group.mutate({ action: 'link', customer_group_id: groupId })}>
                        Vincular
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : tab === 'billing' ? (
            <BillingTab value={billing} onChange={setBillingField} />
          ) : tab === 'addresses' ? (
            <AddressesTab companyId={id} metadata={c.metadata ?? null} />
          ) : tab === 'rules' ? (
            <CompanyRulesTab companyId={id} metadata={c.metadata ?? null} />
          ) : tab === 'credit' ? (
            <CreditTab companyId={id} />
          ) : tab === 'users' ? (
            <MembersSection companyId={id} members={c.members} hasGroup={!!c.customer_group_id} />
          ) : (
            <FiscalDocsTab
              ownerType="company"
              ownerId={id}
              defaultCuit={(c as { tax_id?: string | null }).tax_id}
            />
          )}
        </Drawer.Body>
        {c && tab === 'general' ? (
          <Drawer.Footer>
            <Button size="small" onClick={save} isLoading={update.isPending}>Guardar</Button>
          </Drawer.Footer>
        ) : c && tab === 'billing' ? (
          <Drawer.Footer>
            <Button size="small" onClick={saveBilling} isLoading={update.isPending}>Guardar facturación</Button>
          </Drawer.Footer>
        ) : null}
      </Drawer.Content>
    </Drawer>
  );
};

function CompanyRoleSelect({
  value,
  onChange,
  contentClassName = 'z-[60]',
  includeOwner = false,
}: {
  value: CompanyRole;
  onChange: (r: CompanyRole) => void;
  contentClassName?: string;
  includeOwner?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CompanyRole)}>
      <Select.Trigger>
        <Select.Value />
      </Select.Trigger>
      <Select.Content className={contentClassName}>
        {includeOwner ? <Select.Item value="owner">Dueño</Select.Item> : null}
        <Select.Item value="admin">Administrador</Select.Item>
        <Select.Item value="buyer">Comprador</Select.Item>
        <Select.Item value="viewer">Lector</Select.Item>
      </Select.Content>
    </Select>
  );
}

const CREDIT_STATUS_COLOR: Record<CreditAccountStatus, 'green' | 'orange' | 'red'> = {
  active: 'green',
  suspended: 'orange',
  blocked: 'red',
};

const CREDIT_STATUS_LABELS: Record<CreditAccountStatus, string> = {
  active: 'Activa',
  suspended: 'Suspendida',
  blocked: 'Bloqueada',
};

const TX_TYPE_LABELS: Record<string, string> = {
  compra: 'Compra',
  pago: 'Pago',
  nota_credito: 'Nota de crédito',
  nota_debito: 'Nota de débito',
  ajuste: 'Ajuste',
};

function fmtMoney(n: number, currency = 'ars'): string {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(n);
  }
}

/** Tab "Cuenta Corriente" del detalle de empresa: crear cuenta, editar condiciones,
 *  registrar pago/ajuste y ver el historial de movimientos (inmutable). */
function CreditTab({ companyId }: { companyId: string }) {
  const { data, isLoading } = useCompanyCredit(companyId);
  const createAccount = useCreateCreditAccount(companyId);
  const updateConditions = useUpdateCreditConditions(companyId);
  const createTx = useCreateCreditTransaction(companyId);

  // Form de creación (cuando no hay cuenta).
  const [createForm, setCreateForm] = useState({
    credit_limit: '',
    currency_code: 'ars',
    payment_terms_days: '',
  });
  // Form de condiciones (cuando ya existe).
  const [cond, setCond] = useState({
    credit_limit: '',
    status: 'active' as CreditAccountStatus,
    payment_terms_days: '',
    notes: '',
  });
  // Form de movimiento manual.
  const [tx, setTx] = useState({
    type: 'pago' as 'pago' | 'nota_credito' | 'nota_debito' | 'ajuste',
    amount: '',
    notes: '',
  });

  const account = data?.account ?? null;

  useEffect(() => {
    if (account) {
      setCond({
        credit_limit: String(account.credit_limit),
        status: account.status,
        payment_terms_days:
          account.payment_terms_days != null ? String(account.payment_terms_days) : '',
        notes: account.notes ?? '',
      });
    }
  }, [account]);

  if (isLoading) return <Text className="text-ui-fg-subtle">Cargando…</Text>;

  if (!account) {
    const onCreate = async () => {
      const limit = Number(createForm.credit_limit);
      if (!Number.isFinite(limit) || limit < 0) {
        toast.error('Ingresá un límite de crédito válido.');
        return;
      }
      try {
        await createAccount.mutateAsync({
          credit_limit: limit,
          currency_code: createForm.currency_code.trim() || 'ars',
          payment_terms_days: createForm.payment_terms_days
            ? Number(createForm.payment_terms_days)
            : null,
        });
        toast.success('Cuenta corriente creada');
      } catch (e) {
        toast.error((e as Error).message);
      }
    };
    return (
      <div className="flex flex-col gap-3">
        <Text size="small" className="text-ui-fg-subtle">
          Esta empresa todavía no tiene cuenta corriente. Creala para habilitar el medio de
          pago "Cuenta Corriente" en el checkout.
        </Text>
        <Field label="Límite de crédito">
          <Input
            type="number"
            value={createForm.credit_limit}
            onChange={(e) => setCreateForm({ ...createForm, credit_limit: e.target.value })}
            placeholder="0"
          />
        </Field>
        <Field label="Moneda">
          <Input
            value={createForm.currency_code}
            onChange={(e) => setCreateForm({ ...createForm, currency_code: e.target.value })}
            placeholder="ars"
          />
        </Field>
        <Field label="Días de pago (opcional)">
          <Input
            type="number"
            value={createForm.payment_terms_days}
            onChange={(e) =>
              setCreateForm({ ...createForm, payment_terms_days: e.target.value })
            }
            placeholder="30"
          />
        </Field>
        <div className="flex justify-end">
          <Button size="small" onClick={onCreate} isLoading={createAccount.isPending}>
            Crear cuenta
          </Button>
        </div>
      </div>
    );
  }

  const available = data?.available_credit ?? account.credit_limit - account.current_balance;

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen (único componente visible; el resto son acciones en drawers) */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-ui-border-base p-3">
        <div>
          <Text size="xsmall" className="text-ui-fg-subtle">Estado</Text>
          <StatusBadge color={CREDIT_STATUS_COLOR[account.status]}>
            {CREDIT_STATUS_LABELS[account.status]}
          </StatusBadge>
        </div>
        <div>
          <Text size="xsmall" className="text-ui-fg-subtle">Límite</Text>
          <Text size="small" weight="plus">
            {fmtMoney(account.credit_limit, account.currency_code)}
          </Text>
        </div>
        <div>
          <Text size="xsmall" className="text-ui-fg-subtle">Saldo utilizado</Text>
          <Text size="small" weight="plus">
            {fmtMoney(account.current_balance, account.currency_code)}
          </Text>
        </div>
        <div>
          <Text size="xsmall" className="text-ui-fg-subtle">Crédito disponible</Text>
          <Text
            size="small"
            weight="plus"
            className={available < 0 ? 'text-ui-fg-error' : undefined}
          >
            {fmtMoney(available, account.currency_code)}
          </Text>
        </div>
      </div>

      {/* Acciones — cada una abre un drawer anidado */}
      <div className="flex flex-wrap gap-2">
        <ConditionsDrawer
          companyId={companyId}
          account={account}
          cond={cond}
          setCond={setCond}
          updateConditions={updateConditions}
        />
        <MovementDrawer
          companyId={companyId}
          tx={tx}
          setTx={setTx}
          createTx={createTx}
        />
        <HistoryDrawer companyId={companyId} />
      </div>
    </div>
  );
}

type CondForm = {
  credit_limit: string;
  status: CreditAccountStatus;
  payment_terms_days: string;
  notes: string;
};

/** Drawer anidado: editar condiciones de la cuenta (nunca toca el balance). */
function ConditionsDrawer({
  account,
  cond,
  setCond,
  updateConditions,
}: {
  companyId: string;
  account: { currency_code: string };
  cond: CondForm;
  setCond: (c: CondForm) => void;
  updateConditions: ReturnType<typeof useUpdateCreditConditions>;
}) {
  const [open, setOpen] = useState(false);

  const onSave = async () => {
    const limit = Number(cond.credit_limit);
    if (!Number.isFinite(limit) || limit < 0) {
      toast.error('Ingresá un límite de crédito válido.');
      return;
    }
    try {
      await updateConditions.mutateAsync({
        credit_limit: limit,
        status: cond.status,
        payment_terms_days: cond.payment_terms_days ? Number(cond.payment_terms_days) : null,
        notes: cond.notes.trim() || null,
      });
      toast.success('Condiciones actualizadas');
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button size="small" variant="secondary">Editar condiciones</Button>
      </Drawer.Trigger>
      <Drawer.Content className="z-[60]">
        <Drawer.Header>
          <Heading>Editar condiciones</Heading>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-3 overflow-y-auto">
          <Field label={`Límite de crédito (${account.currency_code.toUpperCase()})`}>
            <Input
              type="number"
              value={cond.credit_limit}
              onChange={(e) => setCond({ ...cond, credit_limit: e.target.value })}
            />
          </Field>
          <Field label="Estado">
            <Select
              value={cond.status}
              onValueChange={(v) => setCond({ ...cond, status: v as CreditAccountStatus })}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content className="z-[70]">
                <Select.Item value="active">Activa</Select.Item>
                <Select.Item value="suspended">Suspendida</Select.Item>
                <Select.Item value="blocked">Bloqueada</Select.Item>
              </Select.Content>
            </Select>
          </Field>
          <Field label="Días de pago">
            <Input
              type="number"
              value={cond.payment_terms_days}
              onChange={(e) => setCond({ ...cond, payment_terms_days: e.target.value })}
            />
          </Field>
          <Field label="Observaciones internas">
            <Input
              value={cond.notes}
              onChange={(e) => setCond({ ...cond, notes: e.target.value })}
            />
          </Field>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">Cancelar</Button>
          </Drawer.Close>
          <Button size="small" onClick={onSave} isLoading={updateConditions.isPending}>
            Guardar
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

type TxForm = {
  type: 'pago' | 'nota_credito' | 'nota_debito' | 'ajuste';
  amount: string;
  notes: string;
};

/** Drawer anidado: registrar un movimiento manual (pago / nota / ajuste). */
function MovementDrawer({
  tx,
  setTx,
  createTx,
}: {
  companyId: string;
  tx: TxForm;
  setTx: (t: TxForm) => void;
  createTx: ReturnType<typeof useCreateCreditTransaction>;
}) {
  const [open, setOpen] = useState(false);

  const onRegister = async () => {
    const amount = Number(tx.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      toast.error('Ingresá un monto distinto de 0.');
      return;
    }
    try {
      await createTx.mutateAsync({ type: tx.type, amount, notes: tx.notes.trim() || null });
      setTx({ type: tx.type, amount: '', notes: '' });
      toast.success('Movimiento registrado');
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button size="small">Registrar movimiento</Button>
      </Drawer.Trigger>
      <Drawer.Content className="z-[60]">
        <Drawer.Header>
          <Heading>Registrar movimiento</Heading>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-3 overflow-y-auto">
          <Text size="xsmall" className="text-ui-fg-subtle">
            El saldo solo se modifica con movimientos. Las compras se registran solas al
            confirmarse un pedido con cuenta corriente.
          </Text>
          <Field label="Tipo">
            <Select
              value={tx.type}
              onValueChange={(v) => setTx({ ...tx, type: v as TxForm['type'] })}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content className="z-[70]">
                <Select.Item value="pago">Pago</Select.Item>
                <Select.Item value="nota_credito">Nota de crédito</Select.Item>
                <Select.Item value="nota_debito">Nota de débito</Select.Item>
                <Select.Item value="ajuste">Ajuste (+/-)</Select.Item>
              </Select.Content>
            </Select>
          </Field>
          <Field label="Monto">
            <Input
              type="number"
              value={tx.amount}
              onChange={(e) => setTx({ ...tx, amount: e.target.value })}
              placeholder={tx.type === 'ajuste' ? '+/-' : '0'}
            />
          </Field>
          <Field label="Observaciones (opcional)">
            <Input value={tx.notes} onChange={(e) => setTx({ ...tx, notes: e.target.value })} />
          </Field>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">Cancelar</Button>
          </Drawer.Close>
          <Button size="small" onClick={onRegister} isLoading={createTx.isPending}>
            Registrar
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

/** Drawer anidado: historial completo de movimientos (inmutable). */
function HistoryDrawer({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const { data: txData, isLoading } = useCompanyCreditTransactions(companyId, { limit: '100' });
  const transactions = txData?.transactions ?? [];

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button size="small" variant="secondary">Ver historial</Button>
      </Drawer.Trigger>
      <Drawer.Content className="z-[60]">
        <Drawer.Header>
          <Heading>Historial de movimientos</Heading>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto">
          {isLoading ? (
            <Text className="text-ui-fg-subtle">Cargando…</Text>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Fecha</Table.HeaderCell>
                  <Table.HeaderCell>Tipo</Table.HeaderCell>
                  <Table.HeaderCell>Monto</Table.HeaderCell>
                  <Table.HeaderCell>Saldo</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {transactions.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={4}>Sin movimientos.</Table.Cell>
                  </Table.Row>
                ) : (
                  transactions.map((t) => (
                    <Table.Row key={t.id}>
                      <Table.Cell>
                        <Text size="xsmall">
                          {new Date(t.created_at).toLocaleDateString('es-AR')}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge size="2xsmall">{TX_TYPE_LABELS[t.type] ?? t.type}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="xsmall">{fmtMoney(t.amount, t.currency_code)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="xsmall">{fmtMoney(t.balance_after, t.currency_code)}</Text>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table>
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dueño',
  admin: 'Administrador',
  buyer: 'Comprador',
  viewer: 'Lector',
};

const MEMBER_STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  invited: 'Invitado',
  disabled: 'Inactivo',
};

/** Formulario de facturación (presentacional). El estado y el guardado los
 *  maneja el drawer padre para poder poner "Guardar" en el Drawer.Footer fijo. */
function BillingTab({
  value: f,
  onChange: set,
}: {
  value: CompanyBilling;
  onChange: (k: keyof CompanyBilling, v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Text size="small" className="text-ui-fg-subtle">
        Datos fiscales de la empresa para emitir comprobantes.
      </Text>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Razón social">
          <Input value={f.legal_name ?? ''} onChange={(e) => set('legal_name', e.target.value)} />
        </Field>
        <Field label="CUIT">
          <Input value={f.tax_id ?? ''} onChange={(e) => set('tax_id', e.target.value)} placeholder="30-12345678-9" />
        </Field>
        <div className="flex flex-col gap-1">
          <Label size="xsmall">Condición frente al IVA</Label>
          <Select value={f.tax_condition ?? 'responsable_inscripto'} onValueChange={(v) => set('tax_condition', v)}>
            <Select.Trigger><Select.Value /></Select.Trigger>
            <Select.Content className="z-[60]">
              {TAX_CONDITIONS.map((t) => (
                <Select.Item key={t.value} value={t.value}>{t.label}</Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <Field label="Email de facturación">
          <Input type="email" value={f.billing_email ?? ''} onChange={(e) => set('billing_email', e.target.value)} placeholder="facturacion@empresa.com" />
        </Field>
        <Field label="Teléfono (opcional)">
          <Input value={f.billing_phone ?? ''} onChange={(e) => set('billing_phone', e.target.value)} />
        </Field>
        <Field label="Domicilio fiscal">
          <Input value={f.address_line_1 ?? ''} onChange={(e) => set('address_line_1', e.target.value)} placeholder="Calle y número" />
        </Field>
        <Field label="Localidad">
          <Input value={f.city ?? ''} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label="Provincia">
          <Input value={f.province ?? ''} onChange={(e) => set('province', e.target.value)} />
        </Field>
        <Field label="Código postal">
          <Input value={f.postal_code ?? ''} onChange={(e) => set('postal_code', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

const EMPTY_ADDR: CompanyAddress = {
  id: '', label: '', address_line_1: '', address_line_2: '', city: '', province: '', postal_code: '', country_code: 'ar', phone: '', contact_name: '',
};

function AddressesTab({
  companyId,
  metadata,
}: {
  companyId: string;
  metadata: Record<string, unknown> | null;
}) {
  const update = useUpdateCompany(companyId);
  const prompt = usePrompt();
  const { i18n } = useTranslation('storeLocations');
  registerStoreLocationsTranslations(i18n);
  const addresses = (metadata?.addresses as CompanyAddress[] | undefined) ?? [];
  const [draft, setDraft] = useState<CompanyAddress | null>(null);

  const persist = async (next: CompanyAddress[]) =>
    update.mutateAsync({ metadata: { ...(metadata ?? {}), addresses: next } as Record<string, unknown> });

  const onSaveDraft = async () => {
    if (!draft) return;
    if (!draft.label.trim() || !draft.address_line_1.trim()) {
      toast.error('Completá al menos etiqueta y domicilio.');
      return;
    }
    const exists = addresses.some((a) => a.id === draft.id);
    const next = exists
      ? addresses.map((a) => (a.id === draft.id ? draft : a))
      : [...addresses, { ...draft, id: draft.id || newAddressId() }];
    try {
      await persist(next);
      setDraft(null);
      toast.success('Dirección guardada');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (addr: CompanyAddress) => {
    const ok = await prompt({ title: 'Eliminar dirección', description: `¿Eliminar "${addr.label}"?`, confirmText: 'Eliminar', cancelText: 'Cancelar', variant: 'danger' });
    if (!ok) return;
    try {
      await persist(addresses.filter((a) => a.id !== addr.id));
      toast.success('Dirección eliminada');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const setD = (k: keyof CompanyAddress, v: string) => setDraft((p) => (p ? { ...p, [k]: v } : p));

  const editing = !!draft && addresses.some((a) => a.id === draft.id);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="small" variant="secondary" onClick={() => setDraft({ ...EMPTY_ADDR, id: newAddressId() })}>
          Crear
        </Button>
      </div>

      {addresses.length === 0 ? (
        <Text size="small" className="text-ui-fg-subtle">Todavía no hay direcciones.</Text>
      ) : (
        <div className="flex flex-col gap-2">
          {addresses.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-ui-border-base p-3">
              <div className="min-w-0">
                <Text size="small" weight="plus">{a.label}</Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {[a.address_line_1, a.address_line_2, a.city, a.province, a.postal_code].filter(Boolean).join(', ')}
                </Text>
                {a.contact_name || a.phone ? (
                  <Text size="xsmall" className="text-ui-fg-subtle">{[a.contact_name, a.phone].filter(Boolean).join(' · ')}</Text>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="small" variant="transparent" onClick={() => setDraft(a)}>Editar</Button>
                <Button size="small" variant="transparent" onClick={() => onDelete(a)}>Eliminar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer anidado: alta / edición de una dirección. */}
      <Drawer open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
        <Drawer.Content className="z-[60]">
          <Drawer.Header>
            <Heading>{editing ? 'Editar dirección' : 'Agregar dirección'}</Heading>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-3 overflow-y-auto">
            {draft ? (
              <>
                <LocationPicker
                  lat={draft.lat ?? ''}
                  lng={draft.lng ?? ''}
                  onPick={(picked: Partial<PickedAddress>) =>
                    setDraft((d) => {
                      if (!d) return d;
                      const { street, ...rest } = picked;
                      return {
                        ...d,
                        ...rest,
                        ...(street !== undefined ? { address_line_1: street } : {}),
                      };
                    })
                  }
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Etiqueta"><Input value={draft.label} onChange={(e) => setD('label', e.target.value)} placeholder="Ej: Depósito central" /></Field>
                  <Field label="Persona de contacto (opcional)"><Input value={draft.contact_name ?? ''} onChange={(e) => setD('contact_name', e.target.value)} /></Field>
                  <Field label="Domicilio"><Input value={draft.address_line_1} onChange={(e) => setD('address_line_1', e.target.value)} placeholder="Calle y número" /></Field>
                  <Field label="Piso / Depto (opcional)"><Input value={draft.address_line_2 ?? ''} onChange={(e) => setD('address_line_2', e.target.value)} /></Field>
                  <Field label="Localidad"><Input value={draft.city} onChange={(e) => setD('city', e.target.value)} /></Field>
                  <Field label="Provincia"><Input value={draft.province} onChange={(e) => setD('province', e.target.value)} /></Field>
                  <Field label="Código postal"><Input value={draft.postal_code} onChange={(e) => setD('postal_code', e.target.value)} /></Field>
                  <Field label="Teléfono (opcional)"><Input value={draft.phone ?? ''} onChange={(e) => setD('phone', e.target.value)} /></Field>
                </div>
              </>
            ) : null}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button size="small" variant="secondary">Cancelar</Button>
            </Drawer.Close>
            <Button size="small" onClick={onSaveDraft} isLoading={update.isPending}>Guardar dirección</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  );
}

function CompanyRulesTab({
  companyId,
  metadata,
}: {
  companyId: string;
  metadata: Record<string, unknown> | null;
}) {
  const update = useUpdateCompany(companyId);
  const prompt = usePrompt();
  const rules = (metadata?.rules as CompanyRule[] | undefined) ?? [];
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CompanyRuleType>('minimum_order_amount');
  const [amount, setAmount] = useState('');
  const [scope, setScope] = useState<RuleScope>('product');
  const [target, setTarget] = useState('');
  const [minQty, setMinQty] = useState('');
  const isQty = type === 'min_quantity_per_item';

  useEffect(() => {
    if (open) {
      setType('minimum_order_amount');
      setAmount('');
      setScope('product');
      setTarget('');
      setMinQty('');
    }
  }, [open]);

  const persist = (next: CompanyRule[]) =>
    update.mutateAsync({ metadata: { ...(metadata ?? {}), rules: next } as Record<string, unknown> });

  const onAdd = async () => {
    let config: Record<string, unknown>;
    if (isQty) {
      const q = Number(minQty);
      if (!target.trim()) return toast.error('Indicá el producto / etiqueta / categoría.');
      if (!(q > 0)) return toast.error('Ingresá una cantidad mínima válida.');
      config = { scope, target: target.trim(), min_qty: Math.round(q) };
    } else {
      const a = Number(amount);
      if (!(a > 0)) return toast.error('Ingresá un monto válido.');
      config = { amount: Math.round(a) };
    }
    try {
      await persist([...rules, { id: newRuleId(), type, enabled: true, config }]);
      setAmount('');
      setTarget('');
      setMinQty('');
      toast.success('Regla agregada');
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggle = async (r: CompanyRule) => {
    try {
      await persist(rules.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (r: CompanyRule) => {
    const ok = await prompt({ title: 'Eliminar regla', description: `¿Eliminar "${describeRule(r)}"?`, confirmText: 'Eliminar', cancelText: 'Cancelar', variant: 'danger' });
    if (!ok) return;
    try {
      await persist(rules.filter((x) => x.id !== r.id));
      toast.success('Regla eliminada');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Drawer open={open} onOpenChange={setOpen}>
          <Drawer.Trigger asChild>
            <Button size="small" variant="secondary">Crear</Button>
          </Drawer.Trigger>
          <Drawer.Content className="z-[60]">
            <Drawer.Header>
              <Heading>Agregar regla</Heading>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-3 overflow-y-auto">
              <div className="flex flex-col gap-1">
                <Label size="xsmall">Tipo de regla</Label>
                <Select value={type} onValueChange={(v) => setType(v as CompanyRuleType)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content className="z-[70]">
                    {(Object.keys(RULE_TYPE_LABELS) as CompanyRuleType[]).map((t) => (
                      <Select.Item key={t} value={t}>{RULE_TYPE_LABELS[t]}</Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>

              {isQty ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <Label size="xsmall">Aplica a</Label>
                    <Select value={scope} onValueChange={(v) => setScope(v as RuleScope)}>
                      <Select.Trigger><Select.Value /></Select.Trigger>
                      <Select.Content className="z-[70]">
                        {(Object.keys(SCOPE_LABELS) as RuleScope[]).map((s) => (
                          <Select.Item key={s} value={s}>{SCOPE_LABELS[s]}</Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                  <Field label={scope === 'product' ? 'SKU del producto' : scope === 'tag' ? 'Etiqueta' : 'Categoría'}>
                    <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={scope === 'product' ? 'SKU-123' : scope === 'tag' ? 'oferta' : 'Bebidas'} />
                  </Field>
                  <Field label="Cantidad mínima">
                    <Input type="number" min={1} value={minQty} onChange={(e) => setMinQty(e.target.value)} placeholder="6" />
                  </Field>
                </div>
              ) : (
                <Field label="Monto ($)">
                  <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" />
                </Field>
              )}
            </Drawer.Body>
            <Drawer.Footer>
              <Drawer.Close asChild>
                <Button size="small" variant="secondary">Cancelar</Button>
              </Drawer.Close>
              <Button size="small" onClick={onAdd} isLoading={update.isPending}>Agregar regla</Button>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer>
      </div>

      {rules.length === 0 ? (
        <Text size="small" className="text-ui-fg-subtle">Todavía no hay reglas.</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Regla</Table.HeaderCell>
              <Table.HeaderCell>Activa</Table.HeaderCell>
              <Table.HeaderCell> </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rules.map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell><Text size="small">{describeRule(r)}</Text></Table.Cell>
                <Table.Cell>
                  <StatusBadge color={r.enabled ? 'green' : 'grey'}>{r.enabled ? 'Sí' : 'No'}</StatusBadge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex justify-end gap-1">
                    <Button size="small" variant="transparent" onClick={() => toggle(r)}>
                      {r.enabled ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button size="small" variant="transparent" onClick={() => remove(r)}>Eliminar</Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  );
}

type MemberRow = {
  id: string;
  customer_id: string;
  role: string;
  status: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

/** Tab "Usuarios": SOLO la tabla con la lista. El alta y el detalle/edición
 *  viven en drawers anidados (mismo patrón que la tab Cuenta Corriente). */
function MembersSection({
  companyId,
  members,
  hasGroup,
}: {
  companyId: string;
  members: MemberRow[];
  hasGroup: boolean;
}) {
  const [selected, setSelected] = useState<MemberRow | null>(null);
  const del = useDeleteCompanyMember(companyId);
  const prompt = usePrompt();

  const onDelete = async (m: MemberRow) => {
    const ok = await prompt({
      title: 'Borrar usuario',
      description: `¿Quitar a ${m.email ?? 'este usuario'} de la empresa?`,
      confirmText: 'Borrar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await del.mutateAsync(m.id);
      toast.success('Usuario borrado');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <AddMemberDrawer companyId={companyId} />
      </div>

      {!hasGroup ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Esta empresa no tiene customer group vinculado: los usuarios no recibirán precios mayoristas
          hasta que vincules uno en la pestaña Comercial.
        </Text>
      ) : null}

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Email</Table.HeaderCell>
            <Table.HeaderCell>Rol</Table.HeaderCell>
            <Table.HeaderCell>Estado</Table.HeaderCell>
            <Table.HeaderCell> </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {members.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={4}>Sin usuarios.</Table.Cell>
            </Table.Row>
          ) : (
            members.map((m) => {
              const fullName = [m.first_name, m.last_name].filter(Boolean).join(' ');
              return (
                <Table.Row key={m.id} className="cursor-pointer" onClick={() => setSelected(m)}>
                  <Table.Cell>
                    <Text size="small">{m.email ?? m.customer_id}</Text>
                    {fullName ? <Text size="xsmall" className="text-ui-fg-subtle">{fullName}</Text> : null}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge size="2xsmall" color={m.role === 'owner' ? 'purple' : 'grey'}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={m.status === 'active' ? 'green' : 'grey'}>
                      {MEMBER_STATUS_LABELS[m.status] ?? m.status}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <IconButton variant="transparent"><EllipsisHorizontal /></IconButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content className="z-[60]">
                          <DropdownMenu.Item onClick={() => setSelected(m)}>Ver</DropdownMenu.Item>
                          <DropdownMenu.Item onClick={() => setSelected(m)}>Editar</DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item className="text-ui-fg-error" onClick={() => onDelete(m)}>
                            Borrar
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    </div>
                  </Table.Cell>
                </Table.Row>
              );
            })
          )}
        </Table.Body>
      </Table>

      <MemberDetailDrawer
        companyId={companyId}
        member={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

/** Drawer anidado: alta de usuario (crea auth + customer para que pueda loguearse). */
function AddMemberDrawer({ companyId }: { companyId: string }) {
  const add = useAddCompanyMember(companyId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '' });
  const [role, setRole] = useState<CompanyRole>('buyer');

  useEffect(() => {
    if (open) {
      setForm({ first_name: '', last_name: '', email: '', phone: '', password: '' });
      setRole('buyer');
    }
  }, [open]);

  const onAdd = async () => {
    if (!/.+@.+\..+/.test(form.email)) {
      toast.error('Ingresá un email válido.');
      return;
    }
    if (form.password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    try {
      // El backend crea la cuenta (auth + customer) para que el usuario pueda iniciar sesión.
      await add.mutateAsync({
        email: form.email.trim(),
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
        role,
      });
      toast.success('Usuario creado. Ya puede iniciar sesión con su email y contraseña.');
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button size="small" variant="secondary">Crear</Button>
      </Drawer.Trigger>
      <Drawer.Content className="z-[60]">
        <Drawer.Header>
          <Heading>Agregar usuario</Heading>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-3 overflow-y-auto">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre">
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </Field>
            <Field label="Apellido">
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" placeholder="usuario@empresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Teléfono (opcional)">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Contraseña">
              <Input type="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <div className="flex flex-col gap-1">
              <Label size="xsmall">Rol</Label>
              <CompanyRoleSelect value={role} onChange={setRole} contentClassName="z-[70]" />
            </div>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">Cancelar</Button>
          </Drawer.Close>
          <Button size="small" onClick={onAdd} isLoading={add.isPending}>Agregar</Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

/** Drawer anidado: ver / editar un usuario (rol, estado) y quitarlo. El dueño
 *  se muestra en solo lectura. Controlado por `member` (null = cerrado). */
function MemberDetailDrawer({
  companyId,
  member,
  onClose,
}: {
  companyId: string;
  member: MemberRow | null;
  onClose: () => void;
}) {
  const update = useUpdateCompanyMember(companyId);
  const del = useDeleteCompanyMember(companyId);
  const prompt = usePrompt();
  const [role, setRole] = useState<CompanyRole>('buyer');

  useEffect(() => {
    if (member) setRole((member.role as CompanyRole) ?? 'buyer');
  }, [member]);

  const isOwner = member?.role === 'owner';
  const fullName = [member?.first_name, member?.last_name].filter(Boolean).join(' ');

  const onSaveRole = async () => {
    if (!member) return;
    try {
      await update.mutateAsync({ memberId: member.id, role });
      toast.success('Rol actualizado');
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onToggleStatus = async () => {
    if (!member) return;
    const next = member.status === 'active' ? 'disabled' : 'active';
    try {
      await update.mutateAsync({ memberId: member.id, status: next });
      toast.success(next === 'active' ? 'Usuario activado' : 'Usuario desactivado');
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onRemove = async () => {
    if (!member) return;
    const ok = await prompt({
      title: 'Quitar usuario',
      description: '¿Quitar este usuario de la empresa?',
      confirmText: 'Quitar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await del.mutateAsync(member.id);
      toast.success('Usuario quitado');
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Drawer open={!!member} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content className="z-[60]">
        <Drawer.Header>
          <Heading>{member?.email ?? 'Usuario'}</Heading>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-ui-border-base p-3">
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle">Nombre</Text>
              <Text size="small" weight="plus">{fullName || '—'}</Text>
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle">Email</Text>
              <Text size="small" weight="plus">{member?.email ?? member?.customer_id}</Text>
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle">Estado</Text>
              <StatusBadge color={member?.status === 'active' ? 'green' : 'grey'}>
                {member ? (MEMBER_STATUS_LABELS[member.status] ?? member.status) : '—'}
              </StatusBadge>
            </div>
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle">Rol</Text>
              <Badge size="2xsmall" color={isOwner ? 'purple' : 'grey'}>
                {member ? (ROLE_LABELS[member.role] ?? member.role) : '—'}
              </Badge>
            </div>
          </div>

          {isOwner ? (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Este es el usuario dueño de la empresa. Si le cambiás el rol o lo borrás, la
              empresa puede quedar sin titular (el rol «Dueño» no se puede reasignar desde acá).
            </Text>
          ) : null}

          <Field label="Rol">
            <CompanyRoleSelect
              value={role}
              onChange={setRole}
              contentClassName="z-[70]"
              includeOwner={isOwner}
            />
          </Field>
        </Drawer.Body>
        <Drawer.Footer>
          <Button size="small" variant="danger" isLoading={del.isPending} onClick={onRemove}>
            Borrar
          </Button>
          <Button size="small" variant="secondary" isLoading={update.isPending} onClick={onToggleStatus}>
            {member?.status === 'active' ? 'Desactivar' : 'Activar'}
          </Button>
          <Button
            size="small"
            onClick={onSaveRole}
            isLoading={update.isPending}
            disabled={member ? role === member.role : true}
          >
            Guardar rol
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

const CreateCompanyDrawer = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const create = useCreateCompany();
  const [form, setForm] = useState({
    name: '',
    legal_name: '',
    tax_id: '',
    owner_customer_id: '',
  });

  useEffect(() => {
    if (open) setForm({ name: '', legal_name: '', tax_id: '', owner_customer_id: '' });
  }, [open]);

  const save = async () => {
    if (form.name.trim().length < 2) {
      toast.error('El nombre es obligatorio (mínimo 2 caracteres).');
      return;
    }
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        legal_name: form.legal_name.trim() || null,
        tax_id: form.tax_id.trim() || null,
        owner_customer_id: form.owner_customer_id.trim() || undefined,
      });
      toast.success('Empresa creada');
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Heading>Nueva empresa</Heading>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label size="xsmall">Nombre</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="xsmall">Razón social</Label>
            <Input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="xsmall">CUIT / Tax ID</Label>
            <Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="xsmall">ID de cliente owner (opcional)</Label>
            <Input
              placeholder="cus_… (vacío: se suman desde el portal mayorista)"
              value={form.owner_customer_id}
              onChange={(e) => setForm({ ...form, owner_customer_id: e.target.value })}
            />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} isLoading={create.isPending}>
            Crear
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

const COMPANIES_PAGE_SIZE = 20;

const CompaniesPage = () => {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const { data, isLoading } = useCompanies({
    q: search || undefined,
    limit: COMPANIES_PAGE_SIZE,
    offset: page * COMPANIES_PAGE_SIZE,
  });
  const [detail, setDetail] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useDeleteCompany();
  const prompt = usePrompt();
  const companies = data?.companies ?? [];
  const count = data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / COMPANIES_PAGE_SIZE));

  const onDelete = async (c: Company) => {
    const ok = await prompt({
      title: 'Eliminar empresa',
      description: `¿Eliminar "${c.name}"? Se borran sus usuarios e invitaciones y se libera el customer group. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await del.mutateAsync(c.id);
      toast.success('Empresa eliminada');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Debounce the search input so we don't refetch on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  return (
    <>
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-x-2">
            <Heading>B2B</Heading>
            <ExtensionVersion extension="b2b" />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="search"
              placeholder="Buscar empresas"
              className="w-[220px]"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <Button size="small" variant="secondary" onClick={() => setCreating(true)}>Crear</Button>
            {/* El slug es `b2b` —el del DESCRIPTOR—, no `companies`, que es el
                directorio. Faltaba acá y estaba sólo en `companies/settings`, que es
                la pantalla a la que MENOS falta le hace: el operador que necesita
                entender los precios mayoristas o el crédito está mirando una empresa,
                no los ajustes de la extensión. */}
            <HelpDrawer slug="b2b" />
          </div>
        </div>

        {/*
          `unscoped`, y NO porque el listado no filtre —filtra: `siteFilter(…,
          COMPANY_SITE_SCOPE)` en `api/admin/companies/route.ts:36`— sino porque el
          ALTA no acompaña. `POST /admin/companies` estampa `getB2bSalesChannelId()`,
          que `modules/company/settings.ts` documenta como la fila GLOBAL: todas las
          tiendas escriben el mismo canal mayorista. El operador crearía una empresa
          parado en su tienda y no volvería a verla en su propio listado.

          Un badge verde acá sería la mentira que este registro existe para evitar: no
          confundiría, engañaría. La misma decisión, con la misma forma, que ya está
          tomada para el tablero de Fidelización — que también está `scoped` en
          `scoped-routes.ts` y también filtra a medias.

          La lectura por id ya cerró: `companies/[id]` corre `assertRowInSite` en GET,
          POST y DELETE. Lo único que falta es el alta, y alcanza para que el badge no
          pueda ser verde. Sube cuando la ruta propague la `SiteResolution` al camino
          async de `app-settings`.
        */}
        <SiteScopeBar screen="companies" />

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Empresa</Table.HeaderCell>
              <Table.HeaderCell>Estado</Table.HeaderCell>
              <Table.HeaderCell>Usuarios</Table.HeaderCell>
              <Table.HeaderCell>Pricing</Table.HeaderCell>
              <Table.HeaderCell> </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row><Table.Cell colSpan={5}>Cargando…</Table.Cell></Table.Row>
            ) : companies.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={5}>No hay empresas todavía.</Table.Cell>
              </Table.Row>
            ) : (
              companies.map((c) => (
                <Table.Row key={c.id} className="cursor-pointer" onClick={() => setDetail(c)}>
                  <Table.Cell><Text size="small" weight="plus">{c.name}</Text></Table.Cell>
                  <Table.Cell><StatusBadge color={STATUS_COLOR[c.status] ?? 'grey'}>{STATUS_LABELS[c.status] ?? c.status}</StatusBadge></Table.Cell>
                  <Table.Cell>{c.members_count ?? '—'}</Table.Cell>
                  <Table.Cell>
                    {c.customer_group_id ? (
                      <Badge size="2xsmall" color="green">grupo</Badge>
                    ) : (
                      <Badge size="2xsmall" color="grey">sin grupo</Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <IconButton variant="transparent"><EllipsisHorizontal /></IconButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                          <DropdownMenu.Item onClick={() => setDetail(c)}>Ver</DropdownMenu.Item>
                          <DropdownMenu.Item onClick={() => setDetail(c)}>Editar</DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item className="text-ui-fg-error" onClick={() => onDelete(c)}>
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
        {count > 0 && (
          <div className="flex items-center justify-between px-6 py-4">
            <Text size="small" className="text-ui-fg-subtle">
              {count} {count === 1 ? 'resultado' : 'resultados'} · Página {page + 1} de {pages}
            </Text>
            <div className="flex gap-2">
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
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Container>

      <CompanyDetail company={detail} onClose={() => setDetail(null)} />
      <CreateCompanyDrawer open={creating} onClose={() => setCreating(false)} />
      <Toaster />
    </>
  );
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label size="xsmall">{label}</Label>
      {children}
    </div>
  );
}

const CompaniesIcon = () => <Buildings style={{ color: '#1D4ED8' }} />;

export const config = defineRouteConfig({
  label: 'B2B',
  icon: CompaniesIcon,
  rank: 96,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'B2B',
};

export default CompaniesPage;
