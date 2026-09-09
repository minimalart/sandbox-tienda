import { Alert, Badge, Button, Container, Heading, Input, Label, Text } from '@medusajs/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { sdk } from '../../../lib/client';
import { CatalogSourceFields } from './catalog-source-fields';
import type { DemoStore, DemoSourceType } from '../../../hooks/api/demo-stores';
import { SITE_ID_HEADER } from '../../../lib/active-site';

const statusLabels: Record<string, string> = {
  pending: 'En cola',
  running: 'En curso',
  completed: 'Completada',
  partial: 'Parcial',
  failed: 'Fallida',
  cancelled: 'Cancelada',
};
const fieldLabels: Record<string, string> = {
  title: 'Título',
  description: 'Descripción',
  images: 'Imágenes',
  categories: 'Categorías',
  price: 'Precio',
  listAmount: 'Precio de lista',
  presentation: 'Presentación',
  purchasePolicy: 'Política de compra',
};
const selectClass =
  'w-full rounded-md border border-ui-border-base bg-ui-bg-field p-2 text-sm focus-visible:outline focus-visible:outline-2';

export function StoreCatalog({ demo }: { demo: DemoStore }) {
  const request = <T,>(url: string, options: any = {}) =>
    sdk.client.fetch<T>(url, {
      ...options,
      headers: { ...options.headers, [SITE_ID_HEADER]: demo.id },
    });
  const initialProvider = ['vtex', 'woocommerce', 'shopify'].includes(demo.source_type)
    ? demo.source_type
    : 'vtex';
  const [sourceType, setSourceType] = useState<DemoSourceType>(initialProvider);
  const [sourceUrl, setSourceUrl] = useState(
    demo.is_main || demo.source_type === 'sales_channel' ? '' : demo.source_url
  );
  const [targetCount, setTargetCount] = useState('');
  function editSource(connection: any = null) {
    setSourceType(connection?.config.provider ?? initialProvider);
    setSourceUrl(
      connection?.config.sourceUrl ??
        (demo.is_main || demo.source_type === 'sales_channel' ? '' : demo.source_url)
    );
    setTargetCount(String(connection?.config.targetCount ?? ''));
    setEditing(connection);
    setPreview(null);
    setFormOpen(true);
  }
  const client = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ['catalog-imports', demo.id],
    queryFn: () => request<any>('/admin/catalog-imports'),
    refetchInterval: 5000,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [selected, setSelected] = useState<string>('');
  const [editing, setEditing] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
      await client.invalidateQueries({ queryKey: ['catalog-imports', demo.id] });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const str = (key: string) => String(values.get(key) ?? '').trim();
    const num = (key: string) => (str(key) ? Number(str(key)) : undefined);
    const config = {
      provider: sourceType,
      sourceUrl: sourceUrl.trim(),
      currencyCode: str('currencyCode'),
      searchStrategy: str('searchStrategy'),
      sellerRef: str('sellerRef') || undefined,
      sourceChannel: str('sourceChannel') || undefined,
      priceTaxIncluded:
        str('priceTaxIncluded') === '' ? undefined : str('priceTaxIncluded') === 'included',
      inventoryMode: str('inventoryMode'),
      targetCount: targetCount ? Number(targetCount) : undefined,
      fieldMapping: {
        unitsPerPackage: str('mappingUnits') || undefined,
        label: str('mappingLabel') || undefined,
      },
      presentation: {
        mode: str('mode'),
        label: str('label') || undefined,
        unitsPerPackage: num('unitsPerPackage'),
        priceBasis: str('priceBasis') || undefined,
      },
      purchasePolicy: {
        enabled: values.has('purchaseEnabled'),
        minQuantity: num('minQuantity'),
        quantityStep: num('quantityStep'),
        allowedModes: values.getAll('allowedModes'),
      },
      protectedFields: values.getAll('protectedFields'),
    };
    await perform(async () => {
      await request(`/admin/catalog-imports${editing ? `/${editing.id}` : ''}`, {
        method: 'POST',
        body: { name: str('name'), enabled: values.has('enabled'), config },
      });
      setFormOpen(false);
      setEditing(null);
      setPreview(null);
    });
  }
  const c = editing?.config ?? {};
  return (
    <div className="flex flex-col gap-4">
      <Container className="space-y-5 p-0 border-0 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading>Importar catálogo</Heading>
            <Text className="text-ui-fg-subtle">
              Importá productos a {demo.name}. Revisá el origen y la muestra antes de confirmar.
            </Text>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              if (formOpen) setFormOpen(false);
              else editSource();
            }}
          >
            Importar catálogo
          </Button>
        </div>
        {(message || error) && (
          <Alert variant="error" role="alert">
            {message || (error as Error).message}
          </Alert>
        )}
        {formOpen && (
          <form
            key={editing?.id ?? 'new'}
            onSubmit={save}
            className="space-y-4 rounded-lg border p-4"
          >
            <Heading level="h2">{editing ? 'Editar conexión' : 'Configurar origen'}</Heading>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nombre"
                name="name"
                defaultValue={editing?.name ?? `Catálogo de ${demo.name}`}
                required
              />
              <div className="sm:col-span-2">
                <CatalogSourceFields
                  sourceType={sourceType}
                  sourceUrl={sourceUrl}
                  targetCount={targetCount}
                  onSourceTypeChange={setSourceType}
                  onSourceUrlChange={setSourceUrl}
                  onTargetCountChange={setTargetCount}
                />
              </div>
              <Field
                label="Moneda del origen"
                name="currencyCode"
                defaultValue={c.currencyCode ?? demo.currency_code}
                placeholder="ARS"
                required
              />
              <SelectField
                label="Impuestos en los precios de origen"
                name="priceTaxIncluded"
                value={
                  c.priceTaxIncluded === undefined
                    ? ''
                    : c.priceTaxIncluded
                      ? 'included'
                      : 'excluded'
                }
                options={[
                  ['', 'Sin confirmar (no mostrar lista tachada)'],
                  ['included', 'Incluidos'],
                  ['excluded', 'No incluidos'],
                ]}
              />
              <SelectField
                label="Estrategia VTEX"
                name="searchStrategy"
                value={c.searchStrategy ?? 'auto'}
                options={[
                  ['auto', 'Automática'],
                  ['intelligent-search', 'Intelligent Search'],
                  ['legacy', 'Legacy'],
                ]}
              />
              <SelectField
                label="Disponibilidad"
                name="inventoryMode"
                value={c.inventoryMode ?? 'ignore'}
                options={[
                  ['ignore', 'Conservar política local'],
                  ['availability-only', 'Usar disponibilidad de origen'],
                ]}
              />
              <Field
                label="Seller de origen (opcional)"
                name="sellerRef"
                defaultValue={c.sellerRef}
              />
              <Field
                label="Canal de origen (opcional)"
                name="sourceChannel"
                defaultValue={c.sourceChannel}
              />
            </div>
            <details>
              <summary className="cursor-pointer font-medium">
                Presentaciones y protección de ediciones
              </summary>
              <Text className="my-3 text-ui-fg-subtle">
                El contenido por bulto es independiente de litros o kilos. Confirmá la equivalencia
                y la base de precio antes de habilitar la compra.
              </Text>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Modo"
                  name="mode"
                  value={c.presentation?.mode ?? 'informational'}
                  options={[
                    ['informational', 'Sólo informativo'],
                    ['grouping', 'Agrupación del mismo SKU'],
                    ['own-sku', 'Presentación con SKU propio'],
                  ]}
                />
                <SelectField
                  label="Base de precio confirmada"
                  name="priceBasis"
                  value={c.presentation?.priceBasis ?? ''}
                  options={[
                    ['', 'Sin confirmar'],
                    ['unit', 'Por unidad del SKU'],
                    ['sku', 'Por caja o pack del SKU'],
                  ]}
                />
                <Field label="Etiqueta" name="label" defaultValue={c.presentation?.label} />
                <Field
                  label="Unidades por bulto"
                  name="unitsPerPackage"
                  type="number"
                  min={1}
                  defaultValue={c.presentation?.unitsPerPackage}
                />
                <Field
                  label="Propiedad VTEX de unidades por bulto"
                  name="mappingUnits"
                  defaultValue={c.fieldMapping?.unitsPerPackage}
                />
                <Field
                  label="Propiedad VTEX de etiqueta"
                  name="mappingLabel"
                  defaultValue={c.fieldMapping?.label}
                />
                <Field
                  label="Mínimo en unidades comprables"
                  name="minQuantity"
                  type="number"
                  min={1}
                  defaultValue={c.purchasePolicy?.minQuantity}
                />
                <Field
                  label="Múltiplo en unidades comprables"
                  name="quantityStep"
                  type="number"
                  min={1}
                  defaultValue={c.purchasePolicy?.quantityStep}
                />
              </div>
              <div className="my-3 flex flex-wrap gap-4">
                <Check
                  name="purchaseEnabled"
                  label="Habilitar compra por presentación"
                  checked={c.purchasePolicy?.enabled}
                />
                <Check
                  name="allowedModes"
                  value="unit"
                  label="Unidad / SKU"
                  checked={c.purchasePolicy?.allowedModes?.includes('unit') ?? true}
                />
                <Check
                  name="allowedModes"
                  value="package"
                  label="Bulto / caja"
                  checked={c.purchasePolicy?.allowedModes?.includes('package')}
                />
              </div>
              <Text>Campos protegidos ante reimportación</Text>
              <div className="mt-2 flex flex-wrap gap-4">
                {Object.entries(fieldLabels).map(([key, label]) => (
                  <Check
                    key={key}
                    name="protectedFields"
                    value={key}
                    label={label}
                    checked={c.protectedFields?.includes(key)}
                  />
                ))}
              </div>
            </details>
            <Check name="enabled" label="Conexión activa" checked={editing?.enabled ?? false} />
            <div className="flex gap-2">
              <Button type="submit" isLoading={busy}>
                Guardar conexión
              </Button>
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
        {!data?.connections?.length && (
          <Text className="text-ui-fg-subtle">
            Todavía no hay conexiones en este destino. Creá una para empezar.
          </Text>
        )}
        {data?.connections?.map((connection: any) => (
          <div
            key={connection.id}
            className="flex flex-wrap items-center justify-between gap-3 border-t py-3"
          >
            <div>
              <Text weight="plus">
                {connection.name}{' '}
                <Badge size="2xsmall">{connection.enabled ? 'Activa' : 'Desactivada'}</Badge>
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {connection.config.sourceUrl} · {connection.config.currencyCode.toUpperCase()}
              </Text>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  editSource(connection);
                }}
              >
                Editar
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  perform(async () => {
                    setPreview(null);
                    setSelected(connection.id);
                    setPreview(
                      await request(`/admin/catalog-imports/${connection.id}/preview`, {
                        method: 'POST',
                      })
                    );
                  })
                }
              >
                Previsualizar
              </Button>
            </div>
          </div>
        ))}
        {preview && (
          <section
            className="space-y-3 rounded-lg border p-4"
            aria-label="Previsualización del catálogo"
          >
            <Heading level="h2">Revisá la muestra</Heading>
            <Text>{preview.note}</Text>
            <Text>
              Estrategia: {preview.report.strategy}. Muestra: {preview.products.length} productos.
              Total estimado: {preview.report.estimatedTotal ?? 'desconocido'}.
            </Text>
            <Text>
              Campos a actualizar:{' '}
              {preview.update_fields.map((f: string) => fieldLabels[f]).join(', ')}.
            </Text>
            {preview.report.warnings.map((w: string) => (
              <Alert key={w} variant="warning">
                {w}
              </Alert>
            ))}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {[
                      'Producto / SKU',
                      'Venta / lista',
                      'Medida',
                      'Presentación',
                      'Acción y protección',
                      'Advertencias',
                    ].map((h) => (
                      <th key={h} className="p-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.products.flatMap((p: any) =>
                    (p.variants ?? [p]).map((v: any, i: number) => (
                      <tr key={`${p.productId}-${i}`} className="border-t">
                        <td className="p-2">
                          {p.title}
                          <br />
                          {v.externalVariantId ?? p.productId}
                        </td>
                        <td className="p-2">
                          {v.price} / {v.listPrice}
                        </td>
                        <td className="p-2">
                          {v.commercial?.unitMultiplier ?? '—'} {v.commercial?.measurementUnit}
                        </td>
                        <td className="p-2">
                          {v.commercial?.presentation?.label ?? 'Informativa'}{' '}
                          {v.commercial?.presentation?.unitsPerPackage
                            ? `× ${v.commercial.presentation.unitsPerPackage}`
                            : ''}
                        </td>
                        <td className="p-2">
                          {p.preview_action}
                          <br />
                          {v.protected_fields?.length
                            ? `Protegidos: ${v.protected_fields.map((f: string) => fieldLabels[f] ?? f).join(', ')}`
                            : 'Sin campos protegidos'}
                        </td>
                        <td className="p-2">{v.commercial?.warnings?.join(' ') || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Button
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  await request(`/admin/catalog-imports/${selected}/execute`, {
                    method: 'POST',
                    body: { configuration_digest: preview.configuration_digest },
                  });
                  setPreview(null);
                })
              }
            >
              Confirmar e importar
            </Button>
          </section>
        )}
      </Container>
      <Container className="space-y-3 p-6">
        <Heading level="h2">Importaciones recientes</Heading>
        {!data?.jobs?.length && (
          <Text className="text-ui-fg-subtle">
            Las ejecuciones aparecerán acá con su avance y resultado.
          </Text>
        )}
        {data?.jobs?.map((job: any) => (
          <div key={job.id} className="space-y-2 border-t py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Text>
                <Badge>{statusLabels[job.status]}</Badge> {job.cursor} procesados ·{' '}
                {job.result?.created ?? 0} creados · {job.result?.updated ?? 0} actualizados ·{' '}
                {job.result?.failed ?? 0} fallidos
              </Text>
              <Button
                size="small"
                variant="secondary"
                disabled={busy || job.status === 'completed'}
                onClick={() =>
                  perform(async () => {
                    await request(`/admin/catalog-imports/jobs/${job.id}`, {
                      method: 'POST',
                      body: {
                        action: ['pending', 'running'].includes(job.status) ? 'cancel' : 'retry',
                      },
                    });
                  })
                }
              >
                {['pending', 'running'].includes(job.status) ? 'Cancelar' : 'Reintentar'}
              </Button>
            </div>
            {job.report?.warnings?.map((w: string) => (
              <Text key={w} size="small">
                {w}
              </Text>
            ))}
            {job.result?.errors?.map((e: any, i: number) => (
              <Text key={i} size="small">
                {e.productId} {e.message}
              </Text>
            ))}
          </div>
        ))}
      </Container>
    </div>
  );
}
function Field({ label, name, ...props }: any) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
function SelectField({ label, name, value, options }: any) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={value} className={selectClass}>
        {options.map(([key, text]: string[]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
function Check({ name, value, label, checked }: any) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} />
      {label}
    </label>
  );
}
