import {
  Badge,
  Button,
  Container,
  Heading,
  StatusBadge,
  Text,
  toast,
  Toaster,
} from '@medusajs/ui';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { HintIcon } from '../../../components/common/setting-label';
import {
  type RenewalCycle,
  useCancelRecurringOrder,
  useForceRenewalCycle,
  usePauseRecurringOrder,
  useRecurringOrder,
  useResumeRecurringOrder,
} from '../../../hooks/api/recurring-orders';
import { fmtDate, fmtMoney, frequencyLabel, STATUS } from '../helpers';

const CYCLE_STATUS: Record<
  RenewalCycle['status'],
  { label: string; color: 'green' | 'orange' | 'red' | 'grey' | 'blue' }
> = {
  scheduled: { label: 'Programado', color: 'grey' },
  processing: { label: 'En proceso', color: 'blue' },
  pending_payment: { label: 'Esperando pago', color: 'blue' },
  success: { label: 'Exitoso', color: 'green' },
  failed: { label: 'Fallido', color: 'red' },
  skipped: { label: 'Omitido', color: 'grey' },
};

const LOG_LABELS: Record<string, string> = {
  created: 'Suscripción creada',
  paused: 'Pausada',
  resumed: 'Reanudada',
  cancelled: 'Cancelada',
  skip_set: 'Pidió omitir la próxima entrega',
  updated: 'Editó la suscripción',
  retention_accepted: 'Aceptó una alternativa a cancelar',
  cycle_pending_payment: 'Renovación generada (esperando pago)',
  cycle_success: 'Renovación pagada (pedido generado)',
  cycle_failed: 'Renovación fallida',
  cycle_expired: 'Link de pago vencido',
  cycle_skipped: 'Renovación omitida',
};

const ACTOR_LABELS: Record<string, string> = {
  customer: 'Cliente',
  admin: 'Admin',
  system: 'Sistema',
};

const REASON_LABELS: Record<string, string> = {
  precio: 'Le resulta caro',
  no_lo_necesito: 'Ya no lo necesita',
  problemas_entrega: 'Problemas con las entregas',
  otro: 'Otro motivo',
};

const OUTCOME_MESSAGES: Record<string, string> = {
  pending_payment: 'Renovación generada: se envió el link de pago al cliente.',
  skipped: 'El ciclo se omitió.',
  failed_retry: 'La ejecución falló; se reintentará automáticamente.',
  failed_terminal: 'La ejecución falló de forma definitiva.',
  not_eligible: 'El ciclo no está en un estado ejecutable.',
};

const RecurringOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isPending, refetch } = useRecurringOrder(id);
  const pause = usePauseRecurringOrder();
  const resume = useResumeRecurringOrder();
  const cancel = useCancelRecurringOrder();
  const force = useForceRenewalCycle();

  const ro = data?.recurring_order;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      await refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (isPending) {
    return (
      <Container className="p-6">
        <Text className="text-ui-fg-subtle">Cargando…</Text>
      </Container>
    );
  }
  if (!ro) {
    return (
      <Container className="p-6">
        <Text className="text-ui-fg-subtle">Suscripción no encontrada.</Text>
        <Button className="mt-4" onClick={() => navigate('/recurring-orders')} variant="secondary">
          Volver al listado
        </Button>
      </Container>
    );
  }

  const status = STATUS[ro.status] ?? STATUS.active;
  const customerName = [ro.shipping_address?.first_name, ro.shipping_address?.last_name]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-y-3">
      {/* Header + acciones */}
      <Container className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-x-3">
            <Heading>Compra recurrente</Heading>
            <StatusBadge color={status.color}>{status.label}</StatusBadge>
            {ro.skip_next_cycle && <Badge size="small">Omite la próxima</Badge>}
          </div>
          <div className="flex gap-2">
            {ro.status === 'active' && (
              <Button
                disabled={pause.isPending}
                onClick={() =>
                  run(() => pause.mutateAsync({ id: ro.id }), 'Suscripción pausada')
                }
                size="small"
                variant="secondary"
              >
                Pausar
              </Button>
            )}
            {(ro.status === 'paused' || ro.status === 'failed') && (
              <Button
                disabled={resume.isPending}
                onClick={() =>
                  run(() => resume.mutateAsync({ id: ro.id }), 'Suscripción reanudada')
                }
                size="small"
                variant="secondary"
              >
                Reanudar
              </Button>
            )}
            {ro.status !== 'cancelled' && ro.status !== 'completed' && (
              <Button
                disabled={cancel.isPending}
                onClick={() => {
                  if (!window.confirm('¿Cancelar esta suscripción?')) return;
                  run(() => cancel.mutateAsync({ id: ro.id }), 'Suscripción cancelada');
                }}
                size="small"
                variant="danger"
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Cliente
            </Text>
            <Text size="small" className="font-medium">
              {customerName || '—'}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {ro.email || ''}
            </Text>
          </div>
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Frecuencia
            </Text>
            <Text size="small" className="font-medium">
              {frequencyLabel(ro.frequency_interval, ro.frequency_count)}
            </Text>
          </div>
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Próxima ejecución
            </Text>
            <Text size="small" className="font-medium">
              {fmtDate(ro.next_execution_at)}
            </Text>
          </div>
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Cobro
            </Text>
            <Text size="small" className="font-medium">
              {ro.payment_mode === 'manual_link' ? 'Link de pago' : ro.payment_mode}
            </Text>
            {ro.consecutive_failures > 0 && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                {ro.consecutive_failures} fallo(s) consecutivo(s)
              </Text>
            )}
          </div>
        </div>
      </Container>

      {/* Items */}
      <Container className="p-6">
        {/* La aclaración de que los importes son el snapshot del alta colgaba al PIE de
            la lista, lejos de la columna de precios que califica y después de todo el
            scroll de productos. Es la aclaración de un dato de esta tabla —no de cómo se
            cobra, que es lo que el drawer explica en "Qué pasa si falta stock o cambió el
            precio"— así que va al tooltip del encabezado de la sección. */}
        <div className="flex min-w-0 items-center gap-2">
          <Heading level="h2">Productos</Heading>
          <HintIcon
            label="Productos"
            hint="Los precios mostrados son el snapshot del alta; cada renovación cobra el precio vigente del canal."
          />
        </div>
        <div className="mt-4 flex flex-col divide-y">
          {(ro.items ?? []).map((item) => (
            <div className="flex items-center gap-3 py-3" key={item.id}>
              {item.product_snapshot?.thumbnail ? (
                <img
                  alt={item.product_snapshot?.title ?? ''}
                  className="h-10 w-10 rounded-md border object-cover"
                  src={item.product_snapshot.thumbnail}
                />
              ) : (
                <div className="h-10 w-10 rounded-md border bg-ui-bg-subtle" />
              )}
              <div className="min-w-0 flex-1">
                <Text size="small" className="truncate font-medium">
                  {item.product_snapshot?.title ?? item.variant_id}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {[item.product_snapshot?.variant_title, item.product_snapshot?.sku]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </div>
              <Text size="small" className="shrink-0 text-ui-fg-subtle">
                ×{item.quantity}
              </Text>
              {item.pricing_snapshot?.unit_price != null && (
                <Text size="small" className="w-28 shrink-0 text-right">
                  {fmtMoney(
                    item.pricing_snapshot.unit_price,
                    item.pricing_snapshot.currency_code,
                  )}
                </Text>
              )}
            </div>
          ))}
        </div>
      </Container>

      {/* Renovaciones */}
      <Container className="p-6">
        <Heading level="h2">Renovaciones</Heading>
        <div className="mt-4 flex flex-col divide-y">
          {(ro.cycles ?? []).map((cycle) => {
            const cs = CYCLE_STATUS[cycle.status] ?? CYCLE_STATUS.scheduled;
            const total = cycle.metadata?.totals;
            const forceable = cycle.status === 'scheduled' || cycle.status === 'failed';
            return (
              <div className="flex flex-col gap-2 py-3" key={cycle.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <StatusBadge color={cs.color}>{cs.label}</StatusBadge>
                    <Text size="small" className="font-medium">
                      {fmtDate(cycle.scheduled_at)}
                    </Text>
                    {total?.total != null && (
                      <Text size="small" className="text-ui-fg-subtle">
                        {fmtMoney(total.total, total.currency_code)}
                      </Text>
                    )}
                    {cycle.attempt_count > 0 && (
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        {cycle.attempt_count} intento(s)
                      </Text>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {cycle.generated_order_id && (
                      <Link
                        className="text-ui-fg-interactive text-sm hover:underline"
                        to={`/orders/${cycle.generated_order_id}`}
                      >
                        Ver pedido
                      </Link>
                    )}
                    {cycle.status === 'pending_payment' && cycle.confirmation_url && (
                      <a
                        className="text-ui-fg-interactive text-sm hover:underline"
                        href={cycle.confirmation_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Link de pago
                      </a>
                    )}
                    {forceable && (
                      <Button
                        disabled={force.isPending}
                        onClick={async () => {
                          try {
                            const { result } = await force.mutateAsync({
                              id: ro.id,
                              cycleId: cycle.id,
                            });
                            const msg =
                              OUTCOME_MESSAGES[result.outcome] ??
                              `Resultado: ${result.outcome}`;
                            if (
                              result.outcome === 'failed_retry' ||
                              result.outcome === 'failed_terminal'
                            ) {
                              toast.error(
                                result.reason ? `${msg} (${result.reason})` : msg,
                              );
                            } else {
                              toast.success(msg);
                            }
                            await refetch();
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                        size="small"
                        variant="secondary"
                      >
                        Forzar ahora
                      </Button>
                    )}
                  </div>
                </div>
                {cycle.last_error && (
                  <Text size="xsmall" className="text-ui-fg-error">
                    {cycle.last_error}
                  </Text>
                )}
                {(cycle.attempts ?? []).length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-ui-fg-subtle">
                      Historial de intentos ({cycle.attempts?.length})
                    </summary>
                    <div className="mt-2 flex flex-col gap-1 pl-4">
                      {(cycle.attempts ?? []).map((a) => (
                        <Text key={a.id} size="xsmall" className="text-ui-fg-subtle">
                          {fmtDate(a.started_at)} — {a.result}
                          {a.error ? ` · ${a.error}` : ''}
                        </Text>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
          {!(ro.cycles ?? []).length && (
            <Text size="small" className="py-3 text-ui-fg-subtle">
              Sin renovaciones todavía.
            </Text>
          )}
        </div>
      </Container>

      {/* Motivo de cancelación / retención */}
      {(ro.cancellation_cases ?? []).length > 0 && (
        <Container className="p-6">
          <Heading level="h2">Cancelación</Heading>
          <div className="mt-4 flex flex-col divide-y">
            {(ro.cancellation_cases ?? []).map((c) => (
              <div className="flex flex-wrap items-center justify-between gap-2 py-2" key={c.id}>
                <div>
                  <Text size="small" className="font-medium">
                    {c.reason ? (REASON_LABELS[c.reason] ?? c.reason) : 'Sin motivo'}
                    {c.reason_note ? ` — “${c.reason_note}”` : ''}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {fmtDate(c.decided_at ?? c.created_at)}
                  </Text>
                </div>
                <StatusBadge
                  color={
                    c.status === 'cancelled'
                      ? 'red'
                      : c.status === 'retained'
                        ? 'green'
                        : 'orange'
                  }
                >
                  {c.status === 'cancelled'
                    ? 'Canceló'
                    : c.status === 'retained'
                      ? `Retenido (${c.retention_offer?.percentage ?? '—'}% × ${c.retention_offer?.cycles ?? '—'})`
                      : c.status === 'paused'
                        ? 'Prefirió pausar'
                        : 'Prefirió omitir'}
                </StatusBadge>
              </div>
            ))}
          </div>
        </Container>
      )}

      {/* Actividad (auditoría) */}
      <Container className="p-6">
        <Heading level="h2">Actividad</Heading>
        {(ro.logs ?? []).length ? (
          <div className="mt-4 flex flex-col gap-y-2">
            {(ro.logs ?? []).map((log) => (
              <div className="flex items-start gap-3" key={log.id}>
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ui-fg-muted" />
                <div className="min-w-0 flex-1">
                  <Text size="small">
                    <span className="font-medium">
                      {LOG_LABELS[log.event] ?? log.event}
                    </span>{' '}
                    <span className="text-ui-fg-subtle">
                      · {ACTOR_LABELS[log.actor_type] ?? log.actor_type}
                    </span>
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {fmtDate(log.created_at)}
                    {log.data?.reason
                      ? ` · ${REASON_LABELS[String(log.data.reason)] ?? String(log.data.reason)}`
                      : ''}
                    {log.data?.error ? ` · ${String(log.data.error)}` : ''}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Text size="small" className="mt-2 text-ui-fg-subtle">
            Sin actividad registrada (los eventos empiezan a registrarse desde esta versión).
          </Text>
        )}
      </Container>
      <Toaster />
    </div>
  );
};

export const handle = {
  breadcrumb: () => 'Detalle',
};

export default RecurringOrderDetail;
