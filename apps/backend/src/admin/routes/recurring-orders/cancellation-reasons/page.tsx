import { Button, Container, Heading, Input, Switch, Text, Toaster, toast } from '@medusajs/ui';
import { useState } from 'react';
import {
  useCreateSubscriptionCancellationReason,
  useDeleteSubscriptionCancellationReason,
  useSubscriptionCancellationReasons,
  useUpdateSubscriptionCancellationReason,
} from '../../../hooks/api/recurring-orders';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { SubscriptionSectionNav } from '../section-nav';

const CancellationReasonsPage = () => {
  const { data, isPending } = useSubscriptionCancellationReasons();
  const create = useCreateSubscriptionCancellationReason();
  const update = useUpdateSubscriptionCancellationReason();
  const remove = useDeleteSubscriptionCancellationReason();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');

  const add = async () => {
    try {
      await create.mutateAsync({
        code: code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        label: label.trim(),
        enabled: true,
        sort_order: (data?.cancellation_reasons.length ?? 0) * 10 + 10,
      });
      setCode('');
      setLabel('');
      toast.success('Motivo creado');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <>
      <Container className="p-0">
        <SubscriptionSectionNav />
        <div className="flex flex-col gap-1 border-b px-6 py-4">
          <Heading>Motivos de cancelación</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            El cliente elige uno antes de cancelar. El comentario libre sigue siendo opcional.
          </Text>
        </div>
        <SiteScopeBar screen="recurring-orders" />
        <div className="flex flex-col gap-3 px-6 py-4">
          {(data?.cancellation_reasons ?? []).map((reason) => (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3" key={reason.id}>
              <div className="min-w-0 flex-1">
                <Text weight="plus">{reason.label}</Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {reason.code} · {reason.sales_channel_id ? 'Canal actual' : 'Global'}
                </Text>
              </div>
              <Switch
                checked={reason.enabled}
                onCheckedChange={(enabled) =>
                  update.mutate(
                    { id: reason.id, enabled },
                    { onError: (error) => toast.error((error as Error).message) },
                  )
                }
              />
              <Button
                size="small"
                variant="danger"
                onClick={() => {
                  if (!window.confirm(`¿Eliminar "${reason.label}"? Las cancelaciones históricas conservarán el código.`)) return;
                  remove.mutate(reason.id, {
                    onSuccess: () => toast.success('Motivo eliminado'),
                    onError: (error) => toast.error((error as Error).message),
                  });
                }}
              >
                Eliminar
              </Button>
            </div>
          ))}
          {isPending && <Text size="small">Cargando…</Text>}
          <div className="mt-2 grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_2fr_auto]">
            <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Código interno" />
            <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Texto que verá el cliente" />
            <Button disabled={!code.trim() || !label.trim()} isLoading={create.isPending} onClick={add}>
              Agregar
            </Button>
          </div>
        </div>
      </Container>
      <Toaster />
    </>
  );
};

export default CancellationReasonsPage;

export const handle = { breadcrumb: () => 'Motivos de cancelación' };
