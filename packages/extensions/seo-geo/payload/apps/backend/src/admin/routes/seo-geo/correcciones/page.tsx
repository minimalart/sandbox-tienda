import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Button, Checkbox, Container, Heading, Input, Text, toast } from '@medusajs/ui';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useApplyCorrections,
  useGenerateCorrections,
  useProductSearch,
  useProductsByIds,
  type CorrectionProposals,
} from '../../../hooks/api/seo-geo';

const GAPS: { key: string; label: string }[] = [
  { key: 'use_cases', label: 'Casos de uso' },
  { key: 'benefits', label: 'Beneficios' },
  { key: 'materials', label: 'Materiales' },
  { key: 'comparison', label: 'Atributos comparables' },
  { key: 'faq', label: 'FAQ' },
  { key: 'meta_title', label: 'Meta title' },
  { key: 'meta_description', label: 'Meta description' },
];

/**
 * SIN franja de tienda: las dos rutas propias (`corrections` y `corrections/apply`)
 * cierran con `assertProductInSite`, pero lo que esta pantalla LEE es `/admin/products`,
 * que es del core de Medusa y no tiene eje — el buscador de abajo lista el catálogo de
 * toda la instancia. Un selector arriba de esa lista prometería un recorte que no
 * existe. Detalle completo en `lib/site-scope.ts`, entrada `seo-geo.correcciones`.
 */
const CorreccionesPage = () => {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState<{ id: string; title: string } | null>(null);
  /*
    `?gap=` viene de los accionables de AI Visibility, que es la pantalla que sabe QUÉ
    falta. Llegar acá con los siete gaps sin marcar obligaba a volver a leer la lista y
    acordarse de cuál se venía a cerrar. Se valida contra `GAPS` porque el parámetro es
    de la URL: un valor inventado dejaría un gap que el backend rechaza.
  */
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const gap = searchParams.get('gap');
    return gap && GAPS.some((g) => g.key === gap) ? { [gap]: true } : {};
  });
  const [result, setResult] = useState<CorrectionProposals | null>(null);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const generate = useGenerateCorrections();
  const apply = useApplyCorrections();
  const { data: searchData, isFetching: searching } = useProductSearch(search);

  /*
    `?ids=` es la muestra de productos afectados por el hallazgo del que se vino. Sin
    ella, “Corregir con IA” sobre 2.660 productos sin descripción aterrizaba en un
    buscador vacío: el operador tenía que adivinar por cuál empezar, que es la parte
    que la pantalla anterior ya sabía y no le pasaba.
  */
  const affectedIds = (searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 20);
  const { data: affectedData } = useProductsByIds(affectedIds);
  const affected = affectedData?.products ?? [];

  const gaps = Object.keys(selected).filter((k) => selected[k]);
  const results = product ? [] : searchData?.products ?? [];

  const onGenerate = async () => {
    if (!product) return;
    try {
      const res = await generate.mutateAsync({ product_id: product.id, gaps: gaps.length ? gaps : undefined });
      setResult(res);
      setApproved(Object.fromEntries(Object.keys(res.proposals).map((k) => [k, true])));
      if (!res.configured) toast.warning('La IA no está configurada (OPENROUTER_API_KEY).');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falló la generación');
    }
  };

  const onApply = async () => {
    if (!result) return;
    const toApply: Record<string, unknown> = {};
    for (const k of Object.keys(result.proposals)) if (approved[k]) toApply[k] = result.proposals[k];
    if (Object.keys(toApply).length === 0) {
      toast.info('No hay propuestas aprobadas para aplicar.');
      return;
    }
    try {
      await apply.mutateAsync({ product_id: result.product_id, approved: toApply });
      toast.success('Correcciones aplicadas al producto.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falló la aplicación');
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Correcciones IA</Heading>
      </div>

      <div className="flex flex-col gap-4 px-6 py-6">
        <Text size="small" className="text-ui-fg-subtle">
          Generá contenido GEO faltante para un producto con IA. Revisás y aprobás antes de aplicar; nunca borra
          contenido existente.
        </Text>

        <div className="flex flex-col gap-2">
          <label className="text-ui-fg-subtle text-xs">Producto</label>
          {product ? (
            <div className="flex items-center justify-between rounded-lg border border-ui-border-base px-3 py-2">
              <Text size="small">{product.title}</Text>
              <Button
                variant="secondary"
                size="small"
                onClick={() => {
                  setProduct(null);
                  setResult(null);
                }}
              >
                Cambiar
              </Button>
            </div>
          ) : (
            <div className="relative">
              {affected.length > 0 && (
                <div className="mb-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
                  <Text size="xsmall" className="text-ui-fg-subtle mb-2 block">
                    Productos afectados por el hallazgo del que venís (muestra de {affected.length}). Elegí uno para ver
                    la propuesta antes de encarar el resto.
                  </Text>
                  <div className="flex max-h-48 flex-col gap-1 overflow-auto">
                    {affected.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setProduct({ id: p.id, title: p.title })}
                        className="rounded px-2 py-1 text-left text-sm hover:bg-ui-bg-base-hover"
                      >
                        {p.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Input
                placeholder="Buscar producto por nombre…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search.trim().length >= 2 && (
                <div className="mt-1 max-h-64 overflow-auto rounded-lg border border-ui-border-base">
                  {searching ? (
                    <div className="px-3 py-2"><Text size="small" className="text-ui-fg-subtle">Buscando…</Text></div>
                  ) : results.length === 0 ? (
                    <div className="px-3 py-2"><Text size="small" className="text-ui-fg-subtle">Sin resultados.</Text></div>
                  ) : (
                    results.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setProduct({ id: p.id, title: p.title });
                          setSearch('');
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-ui-bg-base-hover"
                      >
                        {p.thumbnail && <img src={p.thumbnail} alt="" className="h-8 w-8 rounded object-cover" />}
                        <Text size="small">{p.title}</Text>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {GAPS.map((g) => (
            <label key={g.key} className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!selected[g.key]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [g.key]: !!v }))} />
              {g.label}
            </label>
          ))}
        </div>

        <div>
          <Button onClick={onGenerate} isLoading={generate.isPending} disabled={!product}>Generar propuestas</Button>
          {result?.used_catalogador && (
            <Text size="xsmall" className="mt-2 text-ui-fg-subtle">
              El Catalogador está instalado: también podés usar su flujo revisable para cambios masivos.
            </Text>
          )}
        </div>

        {result && Object.keys(result.proposals).length > 0 && (
          <div className="flex flex-col gap-3">
            <Heading level="h2" className="text-base">Propuestas</Heading>
            {Object.entries(result.proposals).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-ui-border-base p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={!!approved[k]} onCheckedChange={(val) => setApproved((a) => ({ ...a, [k]: !!val }))} />
                    <Badge size="2xsmall">{k}</Badge>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap break-words text-ui-fg-subtle text-xs">
                  {typeof v === 'string' ? v : JSON.stringify(v, null, 2)}
                </pre>
              </div>
            ))}
            <div>
              <Button onClick={onApply} isLoading={apply.isPending}>Aplicar aprobadas</Button>
            </div>
          </div>
        )}
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({ label: 'Correcciones IA' });
export const handle = { breadcrumb: () => 'Correcciones IA' };
export default CorreccionesPage;
