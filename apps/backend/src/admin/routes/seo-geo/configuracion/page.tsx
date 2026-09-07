import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Container, Heading, Input, Select, Switch, Text, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { CardSiteContext } from '../../../components/common/card-site-context';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { MediaLibraryPickerModal } from '@minimalart/mercatto-plugin-media-library/admin/components/media-library-picker';
import { useSeoConfig, useUpdateSeoConfig, type SeoGeoConfig } from '../../../hooks/api/seo-geo';
import { SingleColumnLayout } from '../../../components/layouts/single-column';

const ENGINE_LABELS: Record<string, string> = {
  technical: 'Técnico',
  architecture: 'Arquitectura',
  catalog: 'Catálogo',
  geo: 'GEO',
  commercial: 'Comercial (V3)',
  performance: 'Performance (V3)',
};

const ConfiguracionPage = () => {
  const { data, isLoading } = useSeoConfig();
  const update = useUpdateSeoConfig();
  const [draft, setDraft] = useState<SeoGeoConfig | null>(null);
  const [pickingImage, setPickingImage] = useState(false);

  useEffect(() => {
    if (data?.config && !draft) setDraft(data.config);
  }, [data, draft]);

  if (isLoading || !draft) {
    return (
      <Container className="p-6">
        <Text className="text-ui-fg-subtle">Cargando…</Text>
      </Container>
    );
  }

  const onSave = async () => {
    try {
      await update.mutateAsync(draft);
      toast.success('Configuración guardada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  };

  /**
   * "Hay cambios sin guardar" = el borrador dejó de coincidir con lo que devolvió el
   * GET. Es el `dirty` que necesita la franja de tienda: cambiar de tienda recarga la
   * página (`lib/active-site.ts`) y este formulario guarda TODO el draft, no un patch
   * de lo tocado, así que perderlo a mitad de camino no se nota hasta el próximo save.
   *
   * Se compara serializando y no campo por campo: `SeoGeoConfig` son cinco objetos
   * anidados (`crawl`, `engines`, `simulator`, `automation`, …) y una comparación por
   * clave habría que ampliarla cada vez que el módulo agrega una sección — el modo de
   * falla de olvidarse es un `dirty` que dice `false` sobre un borrador que sí existe,
   * o sea la pérdida silenciosa que la prop obligatoria viene a evitar. El orden de
   * claves es estable porque cada edición de arriba es un spread de `draft`.
   */
  const dirty = Boolean(data?.config) && JSON.stringify(draft) !== JSON.stringify(data?.config);

  return (
    <SingleColumnLayout>
      {/*
        Sin `divide-y`: `CardSiteContext` ya trae su propio `border-b`, y el
        divisor del padre se le sumaba abajo — dos líneas de 1px pegadas se ven
        como una costura de 2px, no como un separador. Cada borde se declara una
        sola vez, en el elemento que lo necesita.
      */}
      <Container className="p-0">
        <div className="flex items-center justify-between border-b border-ui-border-base px-6 py-4">
          <Heading level="h1">Configuración</Heading>
          <div className="flex items-center gap-2">
            <HelpDrawer slug="seo-geo" />
            <Button size="small" onClick={onSave} isLoading={update.isPending}>Guardar</Button>
          </div>
        </div>

        {/*
          `scope="site"` con evidencia, no por analogía con las otras cards de SEO:
          `admin/seo-geo/config` está declarada `{ state: 'scoped' }` en
          `lib/multistore/scoped-routes.ts`, y el route.ts resuelve `siteOf(req)` en el
          GET **y** en el POST (`upsertSeoGeoConfig(..., await siteOf(req))`), o sea que
          se lee y se escribe la misma capa. Y —la mitad que el registro no cuenta— el
          hook va por `sdk.client.fetch`, que lleva `x-site-id` en `globalHeaders`
          (`lib/client.ts`): el selector de acá cambia de verdad la fila que se edita.
          Es justo lo que NO pasa en las pantallas hermanas de blog, loyalty y comments,
          cuyos hooks tienen su propio `fetchJson` sin el header — por eso allá esta
          franja quedó sin montar en vez de prometer un aislamiento inexistente.
        */}
        <CardSiteContext scope="site" dirty={dirty} />

        <div className="flex flex-col gap-8 px-6 py-6">
          <section>
            <Heading level="h2" className="mb-3 text-base">Crawler</Heading>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Máximo de páginas">
                <Input
                  type="number"
                  value={draft.crawl.max_pages}
                  onChange={(e) => setDraft({ ...draft, crawl: { ...draft.crawl, max_pages: Number(e.target.value) } })}
                />
              </Field>
              {/*
                La cuota de fichas va al lado del máximo de páginas porque sólo se
                entiende contra él: es cuánto de ESE presupuesto puede comerse el
                catálogo. Sin ella, un sitemap de miles de productos se lleva el
                crawl entero y la home nunca se audita.
              */}
              <Field label="Máx. fichas de producto">
                <Input
                  type="number"
                  value={draft.crawl.max_product_pages}
                  onChange={(e) =>
                    setDraft({ ...draft, crawl: { ...draft.crawl, max_product_pages: Number(e.target.value) } })
                  }
                />
              </Field>
              <Field label="Profundidad máxima">
                <Input
                  type="number"
                  value={draft.crawl.max_depth}
                  onChange={(e) => setDraft({ ...draft, crawl: { ...draft.crawl, max_depth: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Concurrencia">
                <Input
                  type="number"
                  value={draft.crawl.concurrency}
                  onChange={(e) => setDraft({ ...draft, crawl: { ...draft.crawl, concurrency: Number(e.target.value) } })}
                />
              </Field>
            </div>
          </section>

          <section>
            <Heading level="h2" className="mb-3 text-base">Motores</Heading>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {(Object.keys(ENGINE_LABELS) as Array<keyof SeoGeoConfig['engines']>).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.engines[k]}
                    onCheckedChange={(v) => setDraft({ ...draft, engines: { ...draft.engines, [k]: v } })}
                  />
                  {ENGINE_LABELS[k]}
                </label>
              ))}
            </div>
          </section>

          {/*
            Open Graph va en esta pantalla y no en Preferencias porque es SEO: la card
            es lo que decide si alguien abre el link, y hereda de esta config el eje por
            tienda sin trabajo extra — cada tienda comparte con su propia identidad.

            Todos los campos admiten VACÍO, y vacío no es "sin configurar": significa
            "usá el default del storefront". Guardar el nombre de la tienda a mano acá
            lo congela; dejarlo en blanco lo hace seguir al nombre real. Por eso los
            placeholders dicen qué pasa si se deja así, en vez de sugerir un valor.
          */}
          <section>
            <Heading level="h2" className="mb-3 text-base">Open Graph (cómo se ve al compartir)</Heading>
            <Text size="small" className="text-ui-fg-subtle mb-3 block">
              Lo que muestran WhatsApp, Instagram, X y Slack cuando alguien pega un link de la tienda. Cada campo
              vacío usa el valor por defecto del sitio.
            </Text>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nombre del sitio">
                <Input
                  placeholder="El nombre de la tienda"
                  value={draft.open_graph.site_name}
                  onChange={(e) =>
                    setDraft({ ...draft, open_graph: { ...draft.open_graph, site_name: e.target.value } })
                  }
                />
              </Field>
              <Field label="Título">
                <Input
                  placeholder="El título de cada página"
                  value={draft.open_graph.title}
                  onChange={(e) => setDraft({ ...draft, open_graph: { ...draft.open_graph, title: e.target.value } })}
                />
              </Field>
              <Field label="Descripción">
                <Input
                  placeholder="La descripción de cada página"
                  value={draft.open_graph.description}
                  onChange={(e) =>
                    setDraft({ ...draft, open_graph: { ...draft.open_graph, description: e.target.value } })
                  }
                />
              </Field>
              <Field label="Texto alternativo de la imagen">
                <Input
                  placeholder="El nombre de la tienda"
                  value={draft.open_graph.image_alt}
                  onChange={(e) =>
                    setDraft({ ...draft, open_graph: { ...draft.open_graph, image_alt: e.target.value } })
                  }
                />
              </Field>
              <Field label="Idioma (og:locale)">
                <Input
                  value={draft.open_graph.locale}
                  onChange={(e) => setDraft({ ...draft, open_graph: { ...draft.open_graph, locale: e.target.value } })}
                />
              </Field>
              <Field label="Formato de la card en X">
                <Select
                  value={draft.open_graph.twitter_card}
                  onValueChange={(v) =>
                    setDraft({
                      ...draft,
                      open_graph: { ...draft.open_graph, twitter_card: v as SeoGeoConfig['open_graph']['twitter_card'] },
                    })
                  }
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Formato" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="summary_large_image">Imagen grande</Select.Item>
                    <Select.Item value="summary">Imagen chica</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
              <Field label="Cuenta de X">
                <Input
                  placeholder="@tutienda"
                  value={draft.open_graph.twitter_site}
                  onChange={(e) =>
                    setDraft({ ...draft, open_graph: { ...draft.open_graph, twitter_site: e.target.value } })
                  }
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <label className="text-ui-fg-subtle text-xs">Imagen (1200×630)</label>
              <div className="flex items-center gap-3">
                {/*
                  Vista previa con `<img>` crudo: es una URL absoluta de S3 y no hay
                  ningún componente de imagen del lado del admin. Sin la miniatura, el
                  único control de que se eligió la imagen correcta sería leer la URL.
                */}
                {draft.open_graph.image_url ? (
                  <img
                    src={draft.open_graph.image_url}
                    alt=""
                    className="h-16 w-28 rounded border border-ui-border-base object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-28 items-center justify-center rounded border border-dashed border-ui-border-base">
                    <Text size="xsmall" className="text-ui-fg-muted">Generada</Text>
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2">
                  <Input
                    placeholder="Sin imagen propia: se usa la tarjeta que genera el sitio"
                    value={draft.open_graph.image_url}
                    onChange={(e) =>
                      setDraft({ ...draft, open_graph: { ...draft.open_graph, image_url: e.target.value } })
                    }
                  />
                  <div className="flex items-center gap-2">
                    <Button size="small" variant="secondary" onClick={() => setPickingImage(true)}>
                      Elegir de la biblioteca
                    </Button>
                    {draft.open_graph.image_url && (
                      <Button
                        size="small"
                        variant="transparent"
                        onClick={() => setDraft({ ...draft, open_graph: { ...draft.open_graph, image_url: '' } })}
                      >
                        Quitar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <MediaLibraryPickerModal
              open={pickingImage}
              onOpenChange={setPickingImage}
              onPick={(url) => {
                setDraft({ ...draft, open_graph: { ...draft.open_graph, image_url: url } });
                setPickingImage(false);
              }}
              title="Elegir la imagen de Open Graph"
            />
          </section>

          <section>
            <Heading level="h2" className="mb-3 text-base">Simulador IA</Heading>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.simulator.enabled}
                  onCheckedChange={(v) => setDraft({ ...draft, simulator: { ...draft.simulator, enabled: v } })}
                />
                Habilitado
              </label>
              <Field label="Top K">
                <Input
                  type="number"
                  value={draft.simulator.top_k}
                  onChange={(e) => setDraft({ ...draft, simulator: { ...draft.simulator, top_k: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Similitud mínima">
                <Input
                  type="number"
                  step="0.05"
                  value={draft.simulator.min_similarity}
                  onChange={(e) => setDraft({ ...draft, simulator: { ...draft.simulator, min_similarity: Number(e.target.value) } })}
                />
              </Field>
            </div>
          </section>

          <section>
            <Heading level="h2" className="mb-3 text-base">Automatización</Heading>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.automation.enabled}
                  onCheckedChange={(v) => setDraft({ ...draft, automation: { ...draft.automation, enabled: v } })}
                />
                Auditorías programadas
              </label>
              <Field label="Frecuencia">
                <Select
                  value={draft.automation.frequency}
                  onValueChange={(v) =>
                    setDraft({ ...draft, automation: { ...draft.automation, frequency: v as SeoGeoConfig['automation']['frequency'] } })
                  }
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Frecuencia" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="off">Desactivada</Select.Item>
                    <Select.Item value="weekly">Semanal</Select.Item>
                    <Select.Item value="monthly">Mensual</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
            </div>
          </section>
        </div>
      </Container>

      {/*
        SIN `hideSiteContext`, y no es un olvido — es la diferencia con `loyalty` y
        `erp`, donde sí se apagó.

        Esta pantalla tiene DOS scopes de verdad: la card de arriba edita
        `admin/seo-geo/config`, que es POR TIENDA, y por eso lleva selector. Los
        descriptores de `extension:seo-geo` son `defaultScope: 'instance'`
        (`descriptors/seo-geo.ts:43`, con el motivo escrito: los consume el crawler,
        que corre en jobs sin `SiteResolution`). O sea que esta card NO sigue al
        selector de arriba.

        Callarla sería el peor de los dos mundos: quedaría debajo de una franja que
        dice "Configurando Norte" y el operador leería que estos valores son de Norte.
        No lo son. Acá la repetición no es ruido, es lo único que evita que el
        selector de arriba se lea como si gobernara toda la pantalla.
      */}
      {/*
        `description` de UNA oración. Que lo guardado acá pise el entorno y aplique sin
        redeploy es cierto y no es lo que hay que saber antes de tocar estos números: el
        drawer explica que el crawler corre DENTRO del web service, y por qué subir el
        máximo de páginas a 500 se guarda sin quejarse y el crawl igual se corta.
      */}
      <ExtensionSettingsCard
        namespace="extension:seo-geo"
        description="Modelo de IA, ritmo del crawler y lotes de los jobs."
      />
    </SingleColumnLayout>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label className="text-ui-fg-subtle text-xs">{label}</label>
    {children}
  </div>
);

export const config = defineRouteConfig({ label: 'Configuración' });
export const handle = { breadcrumb: () => 'Configuración' };
export default ConfiguracionPage;
