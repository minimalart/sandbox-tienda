import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Textarea,
  Toaster,
  toast,
} from '@medusajs/ui';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { LoaderFunctionArgs, UIMatch } from 'react-router-dom';
import {
  usePaymentBenefit,
  useCreatePaymentBenefit,
  useUpdatePaymentBenefit,
  type BenefitType,
  type PaymentBenefit,
} from '../../../../hooks/api/payment-benefits';
import { sdk } from '../../../../lib/client';

const TYPES: Array<{ value: BenefitType; label: string }> = [
  { value: 'installments', label: 'Cuotas' },
  { value: 'percentage_discount', label: 'Descuento porcentual' },
  { value: 'fixed_discount', label: 'Descuento fijo' },
  { value: 'refund', label: 'Reintegro' },
  { value: 'cashback', label: 'Cashback' },
  { value: 'custom', label: 'Personalizado' },
];

type FormState = {
  title: string;
  description: string;
  benefit_type: BenefitType;
  provider_code: string;
  discount_value: string;
  max_installments: string;
  max_refund: string;
  minimum_amount: string;
  maximum_amount: string;
  priority: string;
  status: PaymentBenefit['status'];
  hidden: boolean;
  valid_from: string;
  valid_to: string;
  eligibility_scope: string;
  eligibility_ids: string;
  sales_channel_ids: string;
  payment_method: string;
  card_brand: string;
  admin_notes: string;
};

const EMPTY: FormState = {
  title: '',
  description: '',
  benefit_type: 'custom',
  provider_code: 'manual',
  discount_value: '',
  max_installments: '',
  max_refund: '',
  minimum_amount: '',
  maximum_amount: '',
  priority: '0',
  status: 'active',
  hidden: false,
  valid_from: '',
  valid_to: '',
  eligibility_scope: 'global',
  eligibility_ids: '',
  sales_channel_ids: '',
  payment_method: '',
  card_brand: '',
  admin_notes: '',
};

const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));
const listFromCsv = (s: string): string[] =>
  s.split(',').map((x) => x.trim()).filter(Boolean);

const BenefitDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { data, isPending } = usePaymentBenefit(isNew ? '' : (id as string));
  const benefit = data?.payment_benefit;
  const readOnly = !!benefit?.read_only;

  const createMut = useCreatePaymentBenefit();
  const updateMut = useUpdatePaymentBenefit((id as string) ?? '');

  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (benefit) {
      setForm({
        title: benefit.title ?? '',
        description: benefit.description ?? '',
        benefit_type: benefit.benefit_type,
        provider_code: benefit.provider_code ?? 'manual',
        discount_value: benefit.discount_value?.toString() ?? '',
        max_installments: benefit.max_installments?.toString() ?? '',
        max_refund: benefit.max_refund?.toString() ?? '',
        minimum_amount: benefit.minimum_amount?.toString() ?? '',
        maximum_amount: benefit.maximum_amount?.toString() ?? '',
        priority: benefit.priority?.toString() ?? '0',
        status: benefit.status,
        hidden: benefit.hidden,
        valid_from: benefit.valid_from ? benefit.valid_from.slice(0, 10) : '',
        valid_to: benefit.valid_to ? benefit.valid_to.slice(0, 10) : '',
        eligibility_scope: benefit.eligibility?.scope ?? 'global',
        eligibility_ids: (benefit.eligibility?.ids ?? []).join(', '),
        sales_channel_ids: (benefit.sales_channel_ids ?? []).join(', '),
        payment_method: benefit.conditions?.payment_method ?? '',
        card_brand: benefit.conditions?.card_brand ?? '',
        admin_notes: benefit.admin_notes ?? '',
      });
    }
  }, [benefit]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const buildPayload = (): Partial<PaymentBenefit> => {
    const always = {
      priority: Number(form.priority) || 0,
      hidden: form.hidden,
      status: form.status,
      sales_channel_ids: listFromCsv(form.sales_channel_ids),
      admin_notes: form.admin_notes || null,
    };
    if (readOnly) return always as Partial<PaymentBenefit>;
    return {
      ...always,
      title: form.title,
      description: form.description || null,
      benefit_type: form.benefit_type,
      provider_code: form.provider_code,
      discount_value: numOrNull(form.discount_value),
      max_installments: numOrNull(form.max_installments),
      max_refund: numOrNull(form.max_refund),
      minimum_amount: numOrNull(form.minimum_amount),
      maximum_amount: numOrNull(form.maximum_amount),
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
      eligibility: {
        scope: form.eligibility_scope,
        ids: listFromCsv(form.eligibility_ids),
      },
      conditions: {
        payment_method: form.payment_method || null,
        card_brand: form.card_brand || null,
      },
    } as Partial<PaymentBenefit>;
  };

  const handleSave = async () => {
    try {
      if (isNew) {
        if (!form.title.trim()) {
          toast.error('El título es obligatorio');
          return;
        }
        await createMut.mutateAsync(buildPayload());
        toast.success('Beneficio creado');
      } else {
        await updateMut.mutateAsync(buildPayload());
        toast.success('Beneficio actualizado');
      }
      navigate('/payment-benefits/benefits');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    }
  };

  const saving = createMut.isPending || updateMut.isPending;
  const disabledOfficial = readOnly;

  const heading = useMemo(() => {
    if (isNew) return 'Nuevo beneficio';
    return benefit?.title ?? 'Beneficio';
  }, [isNew, benefit]);

  if (!isNew && isPending) {
    return (
      <Container className="p-6">
        <Text className="text-ui-fg-subtle">Cargando…</Text>
      </Container>
    );
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">{heading}</Heading>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" onClick={() => navigate('/payment-benefits/benefits')}>
            Cancelar
          </Button>
          <Button size="small" onClick={handleSave} isLoading={saving}>
            Guardar
          </Button>
        </div>
      </div>

      {readOnly && (
        <div className="px-6 py-3">
          <Text size="small" className="text-ui-fg-muted">
            Beneficio sincronizado ({benefit?.source}). Los datos oficiales son de solo lectura;
            podés ajustar visibilidad, prioridad, canales y notas.
          </Text>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label size="small">Título</Label>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} disabled={disabledOfficial} />
        </div>

        <div className="flex flex-col gap-1 md:col-span-2">
          <Label size="small">Descripción</Label>
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} disabled={disabledOfficial} />
        </div>

        <div className="flex flex-col gap-1">
          <Label size="small">Tipo</Label>
          <Select value={form.benefit_type} onValueChange={(v) => set('benefit_type', v as BenefitType)} disabled={disabledOfficial}>
            <Select.Trigger><Select.Value /></Select.Trigger>
            <Select.Content>
              {TYPES.map((t) => (
                <Select.Item key={t.value} value={t.value}>{t.label}</Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label size="small">Proveedor</Label>
          <Input value={form.provider_code} onChange={(e) => set('provider_code', e.target.value)} disabled={disabledOfficial} />
        </div>

        <div className="flex flex-col gap-1">
          <Label size="small">Valor del descuento</Label>
          <Input type="number" value={form.discount_value} onChange={(e) => set('discount_value', e.target.value)} disabled={disabledOfficial} />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Cuotas</Label>
          <Input type="number" value={form.max_installments} onChange={(e) => set('max_installments', e.target.value)} disabled={disabledOfficial} />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Reintegro máx.</Label>
          <Input type="number" value={form.max_refund} onChange={(e) => set('max_refund', e.target.value)} disabled={disabledOfficial} />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Monto mínimo</Label>
          <Input type="number" value={form.minimum_amount} onChange={(e) => set('minimum_amount', e.target.value)} disabled={disabledOfficial} />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Monto máximo</Label>
          <Input type="number" value={form.maximum_amount} onChange={(e) => set('maximum_amount', e.target.value)} disabled={disabledOfficial} />
        </div>

        <div className="flex flex-col gap-1">
          <Label size="small">Vigencia desde</Label>
          <Input type="date" value={form.valid_from} onChange={(e) => set('valid_from', e.target.value)} disabled={disabledOfficial} />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Vigencia hasta</Label>
          <Input type="date" value={form.valid_to} onChange={(e) => set('valid_to', e.target.value)} disabled={disabledOfficial} />
        </div>

        <div className="flex flex-col gap-1">
          <Label size="small">Aplicabilidad</Label>
          <Select value={form.eligibility_scope} onValueChange={(v) => set('eligibility_scope', v)} disabled={disabledOfficial}>
            <Select.Trigger><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="global">Global</Select.Item>
              <Select.Item value="collection">Colección</Select.Item>
              <Select.Item value="category">Categoría</Select.Item>
              <Select.Item value="brand">Marca</Select.Item>
              <Select.Item value="product">Producto</Select.Item>
            </Select.Content>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">IDs de aplicabilidad (coma)</Label>
          <Input value={form.eligibility_ids} onChange={(e) => set('eligibility_ids', e.target.value)} disabled={disabledOfficial} placeholder="prod_..., pcat_..." />
        </div>

        <div className="flex flex-col gap-1">
          <Label size="small">Medio de pago (condición)</Label>
          <Input value={form.payment_method} onChange={(e) => set('payment_method', e.target.value)} disabled={disabledOfficial} placeholder="visa, master, ..." />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Marca de tarjeta (condición)</Label>
          <Input value={form.card_brand} onChange={(e) => set('card_brand', e.target.value)} disabled={disabledOfficial} />
        </div>
      </div>

      {/* Siempre editables */}
      <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label size="small">Prioridad</Label>
          <Input type="number" value={form.priority} onChange={(e) => set('priority', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Estado</Label>
          <Select value={form.status} onValueChange={(v) => set('status', v as PaymentBenefit['status'])}>
            <Select.Trigger><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="active">Activo</Select.Item>
              <Select.Item value="draft">Borrador</Select.Item>
              <Select.Item value="disabled">Deshabilitado</Select.Item>
            </Select.Content>
          </Select>
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label size="small">Sales channels (coma, vacío = todos)</Label>
          <Input value={form.sales_channel_ids} onChange={(e) => set('sales_channel_ids', e.target.value)} placeholder="sc_..." />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.hidden} onCheckedChange={(v) => set('hidden', v)} />
          <Label size="small">Oculto</Label>
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label size="small">Notas (internas)</Label>
          <Textarea value={form.admin_notes} onChange={(e) => set('admin_notes', e.target.value)} />
        </div>
      </div>
      <Toaster />
    </Container>
  );
};

type DetailLoaderData = { breadcrumb: string };

// Resolve the benefit title for the breadcrumb instead of the raw id.
export async function loader({ params }: LoaderFunctionArgs): Promise<DetailLoaderData> {
  const id = params.id ?? '';
  if (id === 'new') return { breadcrumb: 'Nuevo beneficio' };
  try {
    const { payment_benefit } = await sdk.client.fetch<{ payment_benefit: { title?: string } }>(
      `/admin/payment-benefits/${id}`,
      { method: 'GET' },
    );
    return { breadcrumb: payment_benefit?.title ?? id };
  } catch {
    return { breadcrumb: id };
  }
}

export const handle = {
  breadcrumb: ({ data }: UIMatch<DetailLoaderData>) => data?.breadcrumb ?? '',
};

export default BenefitDetailPage;
