import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Checkbox, Container, Heading, Input, Label, Text, Textarea, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useCatalogadorConfig, useUpdateCatalogadorConfig } from '../../../hooks/api';
// TODO Fase B: los tres componentes host (ExtensionSettingsCard, HelpDrawer,
// SingleColumnLayout) viven en el host bajo apps/backend/src/admin/components/
// y todavia no fueron extraidos a un paquete compartido. La ExtensionSettingsCard
// habilita la override en DB de las credenciales del namespace
// `extension:catalogador`; sin ella el plugin sigue leyendo `process.env` (mismo
// fallback que la version host cuando el descriptor no existe). El drawer de
// ayuda y el layout de una sola columna son cosmeticos.

export const handle = { breadcrumb: () => 'Configuración' };

type AnyConfig = Record<string, any>;

const CatalogadorConfigPage = () => {
  const { data, isPending } = useCatalogadorConfig();
  const update = useUpdateCatalogadorConfig();
  const [cfg, setCfg] = useState<AnyConfig | null>(null);

  useEffect(() => {
    if (data?.config) setCfg(structuredClone(data.config));
  }, [data]);

  if (isPending || !cfg) {
    return (
      <Container>
        <Text>Cargando configuración…</Text>
      </Container>
    );
  }

  const set = (path: string[], value: unknown) => {
    setCfg((prev) => {
      const next = structuredClone(prev!);
      let node: AnyConfig = next;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = value;
      return next;
    });
  };

  const save = () =>
    update
      .mutateAsync(cfg)
      .then(() => toast.success('Configuración guardada'))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Error'));

  const t = cfg.text ?? {};
  const ia = cfg.image_ai ?? {};
  const it = cfg.image_technical ?? {};
  const ext = cfg.external ?? {};
  const rules = cfg.rules ?? {};
  const limits = cfg.limits ?? {};

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
      <Container className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          {/*
            El párrafo que estaba acá abajo del título —dónde se cargan las API keys y
            por qué la de OpenRouter sigue siendo una variable de entorno— se fue al
            drawer. Decía a medias lo que el drawer dice entero: cuál de las DOS
            configuraciones del Catalogador gana sobre cuál. Media regla de precedencia,
            visible todo el tiempo, es peor que la regla completa a un click.
          */}
          <Heading>Configuración del Catalogador</Heading>
          <div className="flex items-center gap-2">
            {/* TODO Fase B: <HelpDrawer slug="catalogador" /> — vive en host */}
            <Button size="small" onClick={save} isLoading={update.isPending}>
              Guardar
            </Button>
          </div>
        </div>

        <Section title="IA de texto">
          <Field label="Modelo">
            <Input value={t.model ?? ''} onChange={(e) => set(['text', 'model'], e.target.value)} />
          </Field>
          <Field label="Idioma">
            <Input value={t.language ?? ''} onChange={(e) => set(['text', 'language'], e.target.value)} />
          </Field>
          <Field label="Tono">
            <Input value={t.tone ?? ''} onChange={(e) => set(['text', 'tone'], e.target.value)} />
          </Field>
          <Field label="Temperatura">
            <Input type="number" step="0.1" value={t.temperature ?? 0.7} onChange={(e) => set(['text', 'temperature'], Number(e.target.value))} />
          </Field>
          <Field label="Máx. tokens">
            <Input type="number" value={t.max_tokens ?? 1500} onChange={(e) => set(['text', 'max_tokens'], Number(e.target.value))} />
          </Field>
          <Field label="Prompt base" full>
            <Textarea value={t.base_prompt ?? ''} onChange={(e) => set(['text', 'base_prompt'], e.target.value)} rows={3} />
          </Field>
        </Section>

        <Section title="IA de imágenes">
          <Field label="Modelo">
            <Input value={ia.model ?? ''} onChange={(e) => set(['image_ai', 'model'], e.target.value)} />
          </Field>
          <Field label="Variaciones">
            <Input type="number" value={ia.variations ?? 2} onChange={(e) => set(['image_ai', 'variations'], Number(e.target.value))} />
          </Field>
          <Field label="Máx. imágenes/producto">
            <Input type="number" value={ia.max_images_per_product ?? 4} onChange={(e) => set(['image_ai', 'max_images_per_product'], Number(e.target.value))} />
          </Field>
          <Field label="Prompt lifestyle" full>
            <Textarea value={ia.lifestyle_prompt ?? ''} onChange={(e) => set(['image_ai', 'lifestyle_prompt'], e.target.value)} rows={2} />
          </Field>
          <Field label="Prompt recreación" full>
            <Textarea value={ia.recreate_prompt ?? ''} onChange={(e) => set(['image_ai', 'recreate_prompt'], e.target.value)} rows={2} />
          </Field>
          <Toggle label="Preservar producto/packaging" checked={ia.preserve_product} onChange={(v) => set(['image_ai', 'preserve_product'], v)} />
        </Section>

        {/*
          Los `min`/`max` espejan `IMAGE_TECHNICAL_BOUNDS` de
          `api/admin/catalogador/config/route.ts`, que es la frontera real: acá son
          una ayuda, no la validación. Importan igual porque sin ellos un campo
          vacío manda `Number('') === 0`, y 0 en `max_dimension` hace explotar
          sharp.
        */}
        <Section title="Procesamiento técnico de imágenes">
          <Field label="Calidad WebP (40-95)">
            <Input
              type="number"
              step={1}
              min={40}
              max={95}
              value={it.webp_quality ?? 82}
              onChange={(e) => set(['image_technical', 'webp_quality'], Number(e.target.value))}
            />
          </Field>
          <Field label="Peso objetivo (KB)">
            <Input
              type="number"
              step={1}
              min={1}
              max={20000}
              value={it.max_kb ?? 200}
              onChange={(e) => set(['image_technical', 'max_kb'], Number(e.target.value))}
            />
          </Field>
          <Field label="Dimensión máx (px)">
            <Input
              type="number"
              step={1}
              min={16}
              max={8000}
              value={it.max_dimension ?? 1600}
              onChange={(e) => set(['image_technical', 'max_dimension'], Number(e.target.value))}
            />
          </Field>
          <Field label="Dimensión mín (px)">
            <Input
              type="number"
              step={1}
              min={0}
              max={8000}
              value={it.min_dimension ?? 500}
              onChange={(e) => set(['image_technical', 'min_dimension'], Number(e.target.value))}
            />
          </Field>
          <Toggle label="Conservar originales" checked={it.keep_originals} onChange={(v) => set(['image_technical', 'keep_originals'], v)} />
        </Section>

        <Section title="Enriquecimiento externo">
          <Toggle label="Habilitar consulta por barcode" checked={ext.barcode_enabled} onChange={(v) => set(['external', 'barcode_enabled'], v)} />
          <Field label="Proveedor de barcode (informativo)" full>
            <Input
              value={ext.barcode_provider ?? ''}
              placeholder="ej. UPCitemdb (el endpoint y la key se cargan más abajo)"
              onChange={(e) => set(['external', 'barcode_provider'], e.target.value)}
            />
          </Field>
          <Toggle label="Habilitar scraping / búsqueda web" checked={ext.scraping_enabled} onChange={(v) => set(['external', 'scraping_enabled'], v)} />
          <Field label="Herramienta de scraping">
            <select
              className="bg-ui-bg-field border-ui-border-base h-8 w-full rounded-md border px-2 text-sm"
              value={ext.scraping_provider ?? 'tavily'}
              onChange={(e) => set(['external', 'scraping_provider'], e.target.value)}
            >
              <option value="tavily">Tavily (búsqueda + extracción; requiere CATALOGADOR_TAVILY_API_KEY)</option>
              <option value="http">HTTP directo (template + anti-SSRF)</option>
            </select>
          </Field>
          <Field label="Dominios permitidos (coma)" full>
            <Input
              value={(ext.allowed_domains ?? []).join(', ')}
              onChange={(e) => set(['external', 'allowed_domains'], e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            />
          </Field>
          <Field label="Dominios bloqueados (coma)" full>
            <Input
              value={(ext.blocked_domains ?? []).join(', ')}
              onChange={(e) => set(['external', 'blocked_domains'], e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            />
          </Field>
          <Field label="Timeout (ms)">
            <Input type="number" value={ext.timeout_ms ?? 8000} onChange={(e) => set(['external', 'timeout_ms'], Number(e.target.value))} />
          </Field>
          <Field label="Máx. páginas/producto">
            <Input type="number" value={ext.max_pages_per_product ?? 3} onChange={(e) => set(['external', 'max_pages_per_product'], Number(e.target.value))} />
          </Field>
        </Section>

        <Section title="Reglas de catálogo">
          <Toggle label="No sobrescribir campos manuales" checked={rules.do_not_overwrite_manual} onChange={(v) => set(['rules', 'do_not_overwrite_manual'], v)} />
          <Toggle label="Sólo completar campos vacíos" checked={rules.only_fill_empty} onChange={(v) => set(['rules', 'only_fill_empty'], v)} />
          <Toggle label="Permitir mejorar existentes" checked={rules.allow_improve_existing} onChange={(v) => set(['rules', 'allow_improve_existing'], v)} />
          <Toggle label="No reemplazar imagen principal automáticamente" checked={rules.no_auto_replace_main_image} onChange={(v) => set(['rules', 'no_auto_replace_main_image'], v)} />
          <Toggle label="Crear snapshot antes de aplicar" checked={rules.snapshot_before_apply} onChange={(v) => set(['rules', 'snapshot_before_apply'], v)} />
          <Toggle label="Exigir revisión de campos con baja confianza" checked={rules.require_review_low_confidence} onChange={(v) => set(['rules', 'require_review_low_confidence'], v)} />
          <Field label="Umbral de baja confianza (0-1)">
            <Input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={rules.low_confidence_threshold ?? 0.5}
              onChange={(e) => set(['rules', 'low_confidence_threshold'], Number(e.target.value))}
            />
          </Field>
        </Section>

        <Section title="Límites operativos">
          <Field label="Máx. productos/ejecución">
            <Input type="number" value={limits.max_products_per_execution ?? 500} onChange={(e) => set(['limits', 'max_products_per_execution'], Number(e.target.value))} />
          </Field>
          <Field label="Generaciones simultáneas">
            <Input type="number" value={limits.max_concurrent_generations ?? 4} onChange={(e) => set(['limits', 'max_concurrent_generations'], Number(e.target.value))} />
          </Field>
          <Field label="Máx. regeneraciones">
            <Input type="number" value={limits.max_regenerations ?? 5} onChange={(e) => set(['limits', 'max_regenerations'], Number(e.target.value))} />
          </Field>
        </Section>
      </Container>

      {/*
        Credenciales y modelos por defecto: DB cifrada > env > default.

        `description` de UNA oración. Que lo guardado acá pise las variables de entorno
        es la mitad de la regla —la otra mitad es que la card de ARRIBA pisa a ésta— y
        media regla de precedencia confunde más de lo que aclara. La regla entera está
        en el drawer.
      */}
      {/*
        TODO Fase B: <ExtensionSettingsCard namespace="extension:catalogador" … />
        vive en el host y habilita el override DB > env de las credenciales. Sin
        ella el plugin cae al mismo fallback pre-`app-settings`: `process.env`
        directo. Ver `src/modules/catalogador/settings.ts`.
      */}
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg border p-4">
    <Heading level="h2" className="mb-3">
      {title}
    </Heading>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
  </div>
);

const Field = ({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) => (
  <div className={full ? 'md:col-span-2' : ''}>
    <Label size="small">{label}</Label>
    {children}
  </div>
);

const Toggle = ({ label, checked, onChange }: { label: string; checked?: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center gap-2">
    <Checkbox checked={Boolean(checked)} onCheckedChange={(c) => onChange(Boolean(c))} />
    <span className="text-sm">{label}</span>
  </label>
);

// Sin `rank`: `sortMenuItemsByRank` manda los hijos con rank ANTES que los sin
// rank, así que ponerle uno la subiría por encima del listado en vez de dejarla
// abajo, que es donde se la busca.
export const config = defineRouteConfig({ label: 'Configuración' });

export default CatalogadorConfigPage;
