import {
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  StatusBadge,
  Switch,
  Text,
  Textarea,
  toast,
  Toaster,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import {
  type SubscriptionPlanBundle,
  type SubscriptionPlanInput,
  useArchiveSubscriptionPlan,
  useCreateSubscriptionPlan,
  useDuplicateSubscriptionPlan,
  usePublishSubscriptionPlan,
  useSubscriptionPlans,
  useUpdateSubscriptionPlan,
} from '../../../hooks/api/recurring-orders';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { SubscriptionSectionNav } from '../section-nav';

type OfferDraft = {
  interval: 'day' | 'week' | 'month';
  count: string;
  discountType: 'none' | 'percentage' | 'fixed_amount' | 'fixed_price';
  discountValue: string;
  fixedPrices: string;
};

const blankOffer = (): OfferDraft => ({
  interval: 'month',
  count: '1',
  discountType: 'percentage',
  discountValue: '10',
  fixedPrices: '',
});

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <Label>{label}</Label>
    {children}
  </div>
);

function PlanDrawer({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SubscriptionPlanBundle | null;
}) {
  const create = useCreateSubscriptionPlan();
  const update = useUpdateSubscriptionPlan();
  const [name, setName] = useState(editing?.plan.name ?? '');
  const [pricePolicy, setPricePolicy] = useState<'dynamic' | 'fixed'>(editing?.plan.price_policy ?? 'dynamic');
  const [stack, setStack] = useState(editing?.plan.allow_stacking ?? false);
  const [minimumCycles, setMinimumCycles] = useState(String(editing?.plan.minimum_cycles ?? 0));
  const [trialDays, setTrialDays] = useState(String(editing?.plan.trial_days ?? 0));
  const [preflightHours, setPreflightHours] = useState(String(editing?.plan.preflight_hours ?? 72));
  const [reservationHours, setReservationHours] = useState(String(editing?.plan.reservation_hours ?? 24));
  const [stockRetryHours, setStockRetryHours] = useState(String(editing?.plan.stock_retry_hours ?? 72));
  const [stockRetryIntervalHours, setStockRetryIntervalHours] = useState(String(editing?.plan.stock_retry_interval_hours ?? 6));
  const [paymentRetryHours, setPaymentRetryHours] = useState(String(editing?.plan.payment_retry_hours ?? 72));
  const [paymentRetryIntervalHours, setPaymentRetryIntervalHours] = useState(String(editing?.plan.payment_retry_interval_hours ?? 6));
  const [targetType, setTargetType] = useState<'product' | 'variant' | 'category' | 'tag'>(
    editing?.targets[0]?.target_type ?? 'product',
  );
  const [targetIds, setTargetIds] = useState(
    editing?.targets.map((target) => target.target_id).join(', ') ?? '',
  );
  const [offers, setOffers] = useState<OfferDraft[]>(
    editing?.offers.length
      ? editing.offers.map((offer) => ({
          interval: offer.frequency_interval,
          count: String(offer.frequency_count),
          discountType: offer.discount_type,
          discountValue: String(offer.discount_value),
          fixedPrices: '',
        }))
      : [blankOffer()],
  );

  const save = async () => {
    try {
      const targets = targetIds.split(',').map((value) => value.trim()).filter(Boolean);
      if (!name.trim() || !targets.length) throw new Error('Completá el nombre y al menos un alcance.');
      const input: SubscriptionPlanInput = {
        sales_channel_id: editing?.plan.sales_channel_id ?? null,
        name: name.trim(),
        purchase_mode: 'one_time_and_subscription',
        price_policy: pricePolicy,
        promotion_policy: stack ? 'stack' : 'best_benefit',
        allow_stacking: stack,
        currency_code: editing?.plan.currency_code ?? 'ars',
        preflight_hours: Math.max(1, Number(preflightHours) || 72),
        reservation_hours: Math.max(1, Number(reservationHours) || 24),
        stock_retry_hours: Math.max(1, Number(stockRetryHours) || 72),
        stock_retry_interval_hours: Math.max(1, Number(stockRetryIntervalHours) || 6),
        payment_retry_hours: Math.max(1, Number(paymentRetryHours) || 72),
        payment_retry_interval_hours: Math.max(1, Number(paymentRetryIntervalHours) || 6),
        forecast_windows: [14, 30],
        trial_days: Math.max(0, Number(trialDays) || 0),
        minimum_cycles: Math.max(0, Number(minimumCycles) || 0),
        offers: offers.map((offer) => {
          let fixed_unit_prices: Record<string, number> | null = null;
          if (pricePolicy === 'fixed' && offer.fixedPrices.trim()) {
            fixed_unit_prices = JSON.parse(offer.fixedPrices) as Record<string, number>;
          }
          return {
            frequency_interval: offer.interval,
            frequency_count: Math.max(1, Number(offer.count) || 1),
            discount_type: offer.discountType,
            discount_value: Math.max(0, Number(offer.discountValue) || 0),
            fixed_unit_prices,
          };
        }),
        targets: targets.map((target_id) => ({ target_type: targetType, target_id })),
      };
      if (editing) await update.mutateAsync({ id: editing.plan.id, input });
      else await create.mutateAsync(input);
      toast.success(editing?.plan.status === 'active' ? 'Nueva versión creada' : 'Plan guardado');
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="z-[60]">
        <Drawer.Header>
          <Heading>{editing ? 'Editar plan' : 'Crear plan'}</Heading>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-5 overflow-y-auto">
          <Field label="Nombre del plan"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Política de precio">
              <Select value={pricePolicy} onValueChange={(value) => setPricePolicy(value as 'dynamic' | 'fixed')}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content className="z-[70]">
                  <Select.Item value="dynamic">Precio vigente</Select.Item>
                  <Select.Item value="fixed">Precio contratado</Select.Item>
                </Select.Content>
              </Select>
            </Field>
            <Field label="Ciclos mínimos"><Input type="number" min="0" value={minimumCycles} onChange={(event) => setMinimumCycles(event.target.value)} /></Field>
          </div>
          <div className="flex items-center justify-between rounded border p-3">
            <div><Text weight="plus">Acumular beneficios</Text><Text size="small" className="text-ui-fg-subtle">Aplica promociones y descuento del plan juntos.</Text></div>
            <Switch checked={stack} onCheckedChange={setStack} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prueba (días)"><Input type="number" min="0" value={trialDays} onChange={(event) => setTrialDays(event.target.value)} /></Field>
            <Field label="Preflight (horas)"><Input type="number" min="1" value={preflightHours} onChange={(event) => setPreflightHours(event.target.value)} /></Field>
            <Field label="Reserva (horas)"><Input type="number" min="1" value={reservationHours} onChange={(event) => setReservationHours(event.target.value)} /></Field>
            <Field label="Ventana sin stock (horas)"><Input type="number" min="1" value={stockRetryHours} onChange={(event) => setStockRetryHours(event.target.value)} /></Field>
            <Field label="Reintento de stock (horas)"><Input type="number" min="1" value={stockRetryIntervalHours} onChange={(event) => setStockRetryIntervalHours(event.target.value)} /></Field>
            <Field label="Gracia de pago (horas)"><Input type="number" min="1" value={paymentRetryHours} onChange={(event) => setPaymentRetryHours(event.target.value)} /></Field>
            <Field label="Backoff de pago base (horas)"><Input type="number" min="1" value={paymentRetryIntervalHours} onChange={(event) => setPaymentRetryIntervalHours(event.target.value)} /></Field>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between"><Heading level="h2">Frecuencias</Heading><Button size="small" variant="secondary" onClick={() => setOffers([...offers, blankOffer()])}>Agregar</Button></div>
            {offers.map((offer, index) => (
              <div key={index} className="flex flex-col gap-3 rounded border p-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Cada"><Input type="number" min="1" value={offer.count} onChange={(event) => setOffers(offers.map((row, i) => i === index ? { ...row, count: event.target.value } : row))} /></Field>
                  <Field label="Período">
                    <Select value={offer.interval} onValueChange={(value) => setOffers(offers.map((row, i) => i === index ? { ...row, interval: value as OfferDraft['interval'] } : row))}>
                      <Select.Trigger><Select.Value /></Select.Trigger><Select.Content className="z-[70]"><Select.Item value="day">Días</Select.Item><Select.Item value="week">Semanas</Select.Item><Select.Item value="month">Meses</Select.Item></Select.Content>
                    </Select>
                  </Field>
                  <Field label="Beneficio">
                    <Select value={offer.discountType} onValueChange={(value) => setOffers(offers.map((row, i) => i === index ? { ...row, discountType: value as OfferDraft['discountType'] } : row))}>
                      <Select.Trigger><Select.Value /></Select.Trigger><Select.Content className="z-[70]"><Select.Item value="none">Sin descuento</Select.Item><Select.Item value="percentage">Porcentaje</Select.Item><Select.Item value="fixed_amount">Monto fijo</Select.Item><Select.Item value="fixed_price">Precio final</Select.Item></Select.Content>
                    </Select>
                  </Field>
                  <Field label="Valor"><Input type="number" min="0" value={offer.discountValue} onChange={(event) => setOffers(offers.map((row, i) => i === index ? { ...row, discountValue: event.target.value } : row))} /></Field>
                </div>
                {pricePolicy === 'fixed' && <Field label="Precios por variante (JSON)"><Textarea placeholder={'{"variant_id": 12500}'} value={offer.fixedPrices} onChange={(event) => setOffers(offers.map((row, i) => i === index ? { ...row, fixedPrices: event.target.value } : row))} /></Field>}
                {offers.length > 1 && <Button size="small" variant="transparent" onClick={() => setOffers(offers.filter((_, i) => i !== index))}>Quitar frecuencia</Button>}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-3">
            <Field label="Tipo de alcance"><Select value={targetType} onValueChange={(value) => setTargetType(value as typeof targetType)}><Select.Trigger><Select.Value /></Select.Trigger><Select.Content className="z-[70]"><Select.Item value="product">Productos</Select.Item><Select.Item value="variant">Variantes</Select.Item><Select.Item value="category">Categorías</Select.Item><Select.Item value="tag">Tags</Select.Item></Select.Content></Select></Field>
            <Field label="IDs separados por coma"><Input value={targetIds} onChange={(event) => setTargetIds(event.target.value)} placeholder="prod_..., prod_..." /></Field>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button isLoading={create.isPending || update.isPending} onClick={save}>Guardar</Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

const SubscriptionPlansPage = () => {
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<SubscriptionPlanBundle | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data, isPending } = useSubscriptionPlans({ limit: 20, offset: page * 20 });
  const publish = usePublishSubscriptionPlan();
  const archive = useArchiveSubscriptionPlan();
  const duplicate = useDuplicateSubscriptionPlan();
  const rows = useMemo(() => data?.plans ?? [], [data]);

  const act = async (action: () => Promise<unknown>, message: string) => {
    try { await action(); toast.success(message); } catch (error) { toast.error((error as Error).message); }
  };
  return (
    <>
      <Container className="p-0">
        <SubscriptionSectionNav />
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div><Heading>Planes de suscripción</Heading><Text size="small" className="text-ui-fg-subtle">Frecuencias, precios, beneficios y productos alcanzados.</Text></div>
          <Button onClick={() => { setEditing(null); setDrawerOpen(true); }}>Crear plan</Button>
        </div>
        <SiteScopeBar screen="recurring-orders.plans" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b text-ui-fg-subtle"><th className="px-6 py-3">Plan</th><th>Versión</th><th>Frecuencias</th><th>Precio</th><th>Estado</th><th>Suscripciones</th><th className="pr-6 text-right">Acciones</th></tr></thead>
            <tbody>
              {rows.map((bundle) => <tr key={bundle.plan.id} className="border-b last:border-0"><td className="px-6 py-4"><button className="font-medium hover:underline" onClick={() => { setEditing(bundle); setDrawerOpen(true); }}>{bundle.plan.name}</button></td><td>v{bundle.plan.version}</td><td>{bundle.offers.length}</td><td>{bundle.plan.price_policy === 'dynamic' ? 'Vigente' : 'Fijo'}</td><td><StatusBadge color={bundle.plan.status === 'active' ? 'green' : bundle.plan.status === 'draft' ? 'orange' : 'grey'}>{bundle.plan.status === 'active' ? 'Publicado' : bundle.plan.status === 'draft' ? 'Borrador' : 'Archivado'}</StatusBadge></td><td>{bundle.impacted_subscriptions ?? 0}</td><td className="pr-6 text-right"><div className="flex justify-end gap-2">{bundle.plan.status === 'draft' && <Button size="small" variant="secondary" onClick={() => act(() => publish.mutateAsync(bundle.plan.id), 'Plan publicado')}>Publicar</Button>}<Button size="small" variant="secondary" onClick={() => act(() => duplicate.mutateAsync(bundle.plan.id), 'Copia creada')}>Duplicar</Button>{bundle.plan.status !== 'archived' && <Button size="small" variant="danger" onClick={() => { if (window.confirm(`Archivar este plan afectará la administración de ${bundle.impacted_subscriptions ?? 0} suscripciones existentes. Los contratos seguirán vigentes. ¿Continuar?`)) void act(() => archive.mutateAsync(bundle.plan.id), 'Plan archivado'); }}>Archivar</Button>}</div></td></tr>)}
              {!isPending && !rows.length && <tr><td colSpan={7} className="px-6 py-10 text-center text-ui-fg-subtle">Todavía no hay planes.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-3"><Button size="small" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button><Button size="small" variant="secondary" disabled={(page + 1) * 20 >= (data?.count ?? 0)} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
      </Container>
      {drawerOpen && <PlanDrawer key={editing?.plan.id ?? 'new'} open={drawerOpen} onOpenChange={setDrawerOpen} editing={editing} />}
      <Toaster />
    </>
  );
};

export default SubscriptionPlansPage;

export const handle = { breadcrumb: () => 'Planes' };
