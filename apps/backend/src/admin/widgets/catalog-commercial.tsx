import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { AdminProduct } from '@medusajs/types';
import { Button, Container, Heading, Input, Text } from '@medusajs/ui';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sdk } from '../lib/client';

const CatalogCommercialWidget = ({ data }: { data: AdminProduct }) => {
  const client = useQueryClient();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (!data.metadata?.catalog_identity) return null;
  async function save(id: string, event: React.FormEvent<HTMLFormElement>, restore = false) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const variant = data.variants?.find((v) => v.id === id);
    const c = (variant?.metadata as any)?.catalog_commercial;
    try {
      await sdk.client.fetch(`/admin/catalog-imports/variants/${id}`, {
        method: 'POST',
        body: restore
          ? { restore: ['listAmount', 'presentation', 'purchasePolicy'] }
          : {
              listAmount: form.get('listAmount') === '' ? null : Number(form.get('listAmount')),
              presentation: {
                ...c?.presentation,
                mode: String(form.get('mode')),
                priceBasis: String(form.get('priceBasis')) || undefined,
                unitsPerPackage: form.get('units') ? Number(form.get('units')) : undefined,
                label: String(form.get('label')) || undefined,
              },
              purchasePolicy: {
                ...c?.purchasePolicy,
                enabled: form.has('enabled'),
                minQuantity: form.get('min') ? Number(form.get('min')) : undefined,
                quantityStep: form.get('step') ? Number(form.get('step')) : undefined,
                allowedModes: form.getAll('allowedModes'),
              },
            },
      });
      await client.invalidateQueries();
      setMessage('Valores guardados. Las correcciones quedan protegidas ante reimportación.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Container className="space-y-4">
      <Heading level="h2">Datos comerciales de origen</Heading>
      {message && <Text role="status">{message}</Text>}
      {data.variants?.map((v) => {
        const metadata = v.metadata as any;
        const c = metadata?.catalog_commercial;
        const source = metadata?.catalog_source;
        if (!c) return null;
        return (
          <details key={v.id} className="border-t pt-3">
            <summary className="cursor-pointer">
              {v.title} · {metadata.external_variant_id}
            </summary>
            <Text className="my-2">
              Origen: venta {source?.amount ?? '—'}, lista {source?.listAmount ?? '—'}{' '}
              {source?.currencyCode}. Medida: {source?.unitMultiplier ?? '—'}{' '}
              {source?.measurementUnit}. Presentación de origen:{' '}
              {source?.rawPresentation ?? source?.presentation?.unitsPerPackage ?? '—'}.
            </Text>
            <Text size="small">{source?.warnings?.join(' ')}</Text>
            <form
              onSubmit={(event) =>
                save(
                  v.id,
                  event,
                  (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'restore'
                )
              }
              className="mt-3 grid gap-3 sm:grid-cols-2"
            >
              <label className="text-sm">
                Lista efectiva
                <Input
                  name="listAmount"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={c.listAmount ?? ''}
                />
              </label>
              <label className="text-sm">
                Etiqueta
                <Input name="label" defaultValue={c.presentation?.label ?? ''} />
              </label>
              <label className="text-sm">
                Modo
                <select
                  name="mode"
                  defaultValue={c.presentation?.mode ?? 'informational'}
                  className="block w-full rounded border p-2"
                >
                  <option value="informational">Informativo</option>
                  <option value="grouping">Agrupación</option>
                  <option value="own-sku">SKU propio</option>
                </select>
              </label>
              <label className="text-sm">
                Base de precio
                <select
                  name="priceBasis"
                  defaultValue={c.presentation?.priceBasis ?? ''}
                  className="block w-full rounded border p-2"
                >
                  <option value="">Sin confirmar</option>
                  <option value="unit">Por unidad</option>
                  <option value="sku">Por SKU caja</option>
                </select>
              </label>
              <label className="text-sm">
                Unidades por bulto
                <Input
                  name="units"
                  type="number"
                  min="1"
                  defaultValue={c.presentation?.unitsPerPackage ?? ''}
                />
              </label>
              <label className="text-sm">
                Mínimo
                <Input
                  name="min"
                  type="number"
                  min="1"
                  defaultValue={c.purchasePolicy?.minQuantity ?? ''}
                />
              </label>
              <label className="text-sm">
                Múltiplo
                <Input
                  name="step"
                  type="number"
                  min="1"
                  defaultValue={c.purchasePolicy?.quantityStep ?? ''}
                />
              </label>
              <label className="text-sm">
                <input name="enabled" type="checkbox" defaultChecked={c.purchasePolicy?.enabled} />{' '}
                Habilitar presentaciones
              </label>
              <label className="text-sm">
                <input
                  name="allowedModes"
                  value="unit"
                  type="checkbox"
                  defaultChecked={c.purchasePolicy?.allowedModes?.includes('unit')}
                />{' '}
                Permitir unidades / SKU
              </label>
              <label className="text-sm">
                <input
                  name="allowedModes"
                  value="package"
                  type="checkbox"
                  defaultChecked={c.purchasePolicy?.allowedModes?.includes('package')}
                />{' '}
                Permitir bultos / cajas
              </label>
              <Button type="submit" disabled={busy}>
                Guardar y proteger
              </Button>
              <Button type="submit" value="restore" variant="secondary" disabled={busy}>
                Restaurar valores de origen
              </Button>
            </form>
          </details>
        );
      })}
    </Container>
  );
};

export default CatalogCommercialWidget;
export const config = defineWidgetConfig({ zone: 'product.details.after' });
