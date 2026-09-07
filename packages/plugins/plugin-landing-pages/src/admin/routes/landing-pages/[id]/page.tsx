import { Puck, usePuck, type Data } from '@measured/puck';
import '@measured/puck/puck.css';
import {
  Button,
  Checkbox,
  Drawer,
  DropdownMenu,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  Toaster,
  toast,
  usePrompt,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import type { LoaderFunctionArgs, UIMatch } from 'react-router-dom';
import {
  type AiGenerateInput,
  useGenerateLandingPageAI,
  useGenerateLandingPageImageAI,
  useGenerateLandingPageSeoAI,
  useImproveLandingPageCopyAI,
  useLandingPage,
  useTranslateLandingPageAI,
  useUpdateLandingPage,
} from '../../../hooks/api/landing-pages';
import { sdk } from '../../../lib/client';
import { config } from '../../../lib/puck/config';
import { registerLandingPagesTranslations } from '../../../translations/landing-pages';

const EMPTY_DATA = { content: [], root: { props: {} } } as unknown as Data;

const AI_COMPONENTS = [
  'Hero',
  'RichText',
  'ImageBlock',
  'CTA',
  'FAQ',
  'Testimonials',
  'CollectionGrid',
  'ProductGrid',
  'Spacer',
] as const;

type AiMode = 'replace' | 'append' | 'draft_only';

/**
 * Config de un prompt de una sola entrada de texto resuelto vía Drawer de
 * Medusa. Reemplaza a window.prompt (modal nativo) en el admin: el desktop del
 * backoffice siempre usa componentes de Medusa, no diálogos del navegador.
 */
type PromptConfig = {
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  confirmText?: string;
  onConfirm: (value: string) => void;
};

const getStorefrontUrl = (): string => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const url = env?.VITE_STOREFRONT_URL?.trim() || 'http://localhost:3000';
  return url.replace(/\/+$/, '');
};

const LandingPageEditor = () => {
  const { t, i18n } = useTranslation('landingPages');
  registerLandingPagesTranslations(i18n);
  const navigate = useNavigate();
  const prompt = usePrompt();
  const { id = '' } = useParams();

  const { data: landing, isLoading } = useLandingPage(id);
  const updateMut = useUpdateLandingPage(id);
  const generateMut = useGenerateLandingPageAI(id);
  const improveMut = useImproveLandingPageCopyAI(id);
  const translateMut = useTranslateLandingPageAI(id);
  const seoMut = useGenerateLandingPageSeoAI(id);
  const imageMut = useGenerateLandingPageImageAI(id);

  // Puck recibe `data` sólo al montar; para reflejar lo que genera la IA
  // forzamos un remount cambiando `puckKey` y guardamos la data en estado.
  const [editorData, setEditorData] = useState<Data | null>(null);
  const [puckKey, setPuckKey] = useState(0);

  // Form del drawer "Generar con IA".
  const [aiOpen, setAiOpen] = useState(false);
  const [brief, setBrief] = useState('');
  const [tone, setTone] = useState('');
  const [goal, setGoal] = useState('');
  const [audience, setAudience] = useState('');
  const [aiLocale, setAiLocale] = useState('es-AR');
  const [mode, setMode] = useState<AiMode>('replace');
  const [components, setComponents] = useState<string[]>([]);

  // Drawer genérico de "prompt" (reemplaza window.prompt). Una sola instancia:
  // cada acción setea su config y un valor inicial.
  const [promptCfg, setPromptCfg] = useState<PromptConfig | null>(null);
  const [promptValue, setPromptValue] = useState('');

  const openPrompt = (cfg: PromptConfig, initial = '') => {
    setPromptValue(initial);
    setPromptCfg(cfg);
  };
  const closePrompt = () => setPromptCfg(null);
  const confirmPrompt = () => {
    if (!promptCfg) return;
    if (promptCfg.required && !promptValue.trim()) {
      toast.error('Completá el campo para continuar.');
      return;
    }
    const { onConfirm } = promptCfg;
    const value = promptValue;
    closePrompt();
    onConfirm(value);
  };

  // URL del storefront resuelta en runtime desde el backend (STORE_CORS /
  // STOREFRONT_URL): el Preview apunta al sitio real sin depender de
  // VITE_STOREFRONT_URL (build-time, que solía quedar en localhost).
  const [storefrontUrl, setStorefrontUrl] = useState(getStorefrontUrl());
  useEffect(() => {
    fetch('/admin/store-config/storefront-url', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.url) setStorefrontUrl(String(d.url).replace(/\/+$/, ''));
      })
      .catch(() => {
        /* fallback: queda el valor de getStorefrontUrl() */
      });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Text className="text-ui-fg-subtle">…</Text>
      </div>
    );
  }

  if (!landing) {
    return (
      <div className="flex flex-col items-center gap-3 p-12">
        <Text className="text-ui-fg-subtle">Landing not found</Text>
        <Button size="small" variant="secondary" onClick={() => navigate('/landing-pages')}>
          {t('CANCEL')}
        </Button>
      </div>
    );
  }

  const currentData = (editorData ?? landing.puck_data ?? EMPTY_DATA) as Data;
  const aiBusy =
    generateMut.isPending ||
    improveMut.isPending ||
    translateMut.isPending ||
    seoMut.isPending ||
    imageMut.isPending;

  const applyToEditor = (puckData: unknown) => {
    setEditorData(puckData as Data);
    setPuckKey((k) => k + 1);
  };

  const handleSave = async (data: Data) => {
    try {
      await updateMut.mutateAsync({ puck_data: data as any });
      setEditorData(data);
      toast.success(t('UPDATE_SUCCESS'));
    } catch (error: any) {
      toast.error(t('ACTION_ERROR', { msg: error?.message ?? '' }));
    }
  };

  // El botón "Publish" de Puck en realidad guarda el borrador (puck_data); la
  // publicación de la landing se hace desde el listado. Lo relabelamos.
  const PuckSaveButton = () => {
    const { appState } = usePuck();
    return (
      <Button size="small" onClick={() => handleSave(appState.data)}>
        Guardar cambios
      </Button>
    );
  };

  const toggleComponent = (name: string) =>
    setComponents((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    );

  const handleGenerate = async () => {
    if (!brief.trim()) {
      toast.error('Escribí un brief para generar la landing.');
      return;
    }
    const input: AiGenerateInput = {
      brief: brief.trim(),
      tone: tone.trim() || undefined,
      goal: goal.trim() || undefined,
      audience: audience.trim() || undefined,
      locale: aiLocale.trim() || undefined,
      components: components.length ? components : undefined,
      mode,
    };
    try {
      const res = await generateMut.mutateAsync(input);
      applyToEditor(res.puck_data);
      setAiOpen(false);
      toast.success(
        res.saved
          ? 'Landing generada y guardada. Revisá y publicá desde el editor.'
          : 'Borrador generado en el editor. Publicá si te gusta.',
      );
    } catch (error: any) {
      toast.error(error?.message ?? 'Falló la generación AI.');
    }
  };

  const handleImprove = () => {
    openPrompt(
      {
        title: 'Mejorar textos con IA',
        description: 'Se conservan la estructura y los links; solo se reescriben los textos.',
        label: 'Instrucción',
        placeholder: 'Ej: hacer el tono más premium y claro',
        multiline: true,
        required: true,
        confirmText: 'Mejorar',
        onConfirm: async (instruction) => {
          try {
            const res = await improveMut.mutateAsync({
              instruction: instruction.trim(),
              locale: aiLocale,
            });
            applyToEditor(res.puck_data);
            toast.success('Textos mejorados y guardados.');
          } catch (error: any) {
            toast.error(error?.message ?? 'Falló la mejora de copy.');
          }
        },
      },
      'Hacer el tono más premium y claro',
    );
  };

  const handleTranslate = () => {
    openPrompt(
      {
        title: 'Traducir landing con IA',
        description: 'Se traducen solo los textos visibles; links e imágenes se conservan.',
        label: 'Locale destino',
        placeholder: 'en-US',
        required: true,
        confirmText: 'Traducir',
        onConfirm: async (target) => {
          try {
            const res = await translateMut.mutateAsync({ target_locale: target.trim() });
            applyToEditor(res.puck_data);
            toast.success(`Traducido a ${target.trim()} y guardado.`);
          } catch (error: any) {
            toast.error(error?.message ?? 'Falló la traducción.');
          }
        },
      },
      'en-US',
    );
  };

  const runImageGeneration = async (
    ids: string[],
    overwrite: boolean,
    styleHint: string,
  ) => {
    let lastPuck: unknown = null;
    let ok = 0;
    const fails: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const blockId = ids[i]!;
      toast.loading(`Generando imagen ${i + 1}/${ids.length}…`, { id: 'ai-image' });
      try {
        const res = await imageMut.mutateAsync({
          blockId,
          styleHint: styleHint.trim() || undefined,
          overwrite,
        });
        lastPuck = res.puck_data;
        if (!res.skipped) ok += 1;
      } catch (error: any) {
        fails.push(error?.message ?? 'error');
      }
    }
    toast.dismiss('ai-image');
    if (lastPuck) applyToEditor(lastPuck);
    if (fails.length === 0) {
      toast.success(`${ok} imagen(es) generada(s) y guardada(s).`);
    } else {
      toast.error(`${ok} generada(s), ${fails.length} fallaron: ${fails[0]}`);
    }
  };

  const handleGenerateImages = async () => {
    const data = currentData as unknown as {
      content?: Array<{ type?: string; props?: Record<string, any> }>;
      zones?: Record<string, Array<{ type?: string; props?: Record<string, any> }>>;
    };
    const blocks = [
      ...(data.content ?? []),
      ...Object.values(data.zones ?? {}).flat(),
    ];
    // Bloques que admiten imagen (Hero / ImageBlock).
    const imageBlocks = blocks.filter(
      (b) => b?.type === 'Hero' || b?.type === 'ImageBlock',
    );
    const allIds = imageBlocks
      .map((b) => String(b.props?.id ?? ''))
      .filter(Boolean);

    if (allIds.length === 0) {
      toast.info('No hay bloques de imagen (Hero / ImageBlock) en la landing.');
      return;
    }

    // Slots vacíos: Hero sin `image`, ImageBlock sin `src`.
    const emptyIds = imageBlocks
      .filter((b) => {
        if (b?.type === 'Hero') return !String(b.props?.image ?? '').trim();
        return !String(b.props?.src ?? '').trim();
      })
      .map((b) => String(b.props?.id ?? ''))
      .filter(Boolean);

    let ids = emptyIds;
    let overwrite = false;

    // Sin slots vacíos → preguntar si se quiere regenerar las existentes.
    if (emptyIds.length === 0) {
      const confirmed = await prompt({
        title: 'Regenerar imágenes',
        description: `Ya están todas las imágenes generadas (${allIds.length}). ¿Querés regenerarlas? Se reemplazan las actuales por unas nuevas.`,
        confirmText: 'Regenerar',
        cancelText: t('CANCEL'),
      });
      if (!confirmed) return;
      ids = allIds;
      overwrite = true;
    }

    openPrompt({
      title: overwrite ? 'Regenerar imágenes con IA' : 'Generar imágenes con IA',
      description:
        'Las imágenes se generan sin texto (el copy se superpone aparte) y con buen contraste para que el texto se lea. El estilo es opcional; dejalo vacío para automático.',
      label: 'Estilo para las imágenes (opcional)',
      placeholder: 'Ej: minimalista, colores cálidos',
      confirmText: overwrite ? 'Regenerar' : 'Generar',
      onConfirm: (styleHint) => runImageGeneration(ids, overwrite, styleHint),
    });
  };

  const handleSeo = () => {
    openPrompt({
      title: 'Generar SEO con IA',
      description: 'Se generará title/description y se guardará en el SEO de la landing.',
      label: 'Keywords (separadas por coma, opcional)',
      placeholder: 'ofertas, envío gratis, …',
      confirmText: 'Generar',
      onConfirm: async (kw) => {
        try {
          const keywords = kw
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean);
          await seoMut.mutateAsync({
            locale: aiLocale,
            keywords: keywords.length ? keywords : undefined,
          });
          toast.success('SEO generado y guardado.');
        } catch (error: any) {
          toast.error(error?.message ?? 'Falló la generación de SEO.');
        }
      },
    });
  };

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex items-center justify-between border-ui-border-base border-b bg-ui-bg-base px-4 py-2">
        <div className="flex items-center gap-3">
          <Button size="small" variant="transparent" onClick={() => navigate('/landing-pages')}>
            ← {t('CANCEL')}
          </Button>
          <Heading level="h2" className="text-base">
            {landing.title}
          </Heading>
          <Text size="small" className="text-ui-fg-subtle">
            /{landing.slug}
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button size="small" variant="secondary" onClick={() => setAiOpen(true)} disabled={aiBusy}>
            ✨ Generar con IA
          </Button>
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button size="small" variant="transparent" disabled={aiBusy}>
                IA ▾
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item onClick={handleGenerateImages}>Generar imágenes</DropdownMenu.Item>
              <DropdownMenu.Item onClick={handleImprove}>Mejorar textos</DropdownMenu.Item>
              <DropdownMenu.Item onClick={handleTranslate}>Traducir</DropdownMenu.Item>
              <DropdownMenu.Item onClick={handleSeo}>Generar SEO</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
          <a
            href={`${storefrontUrl}/l/${landing.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-ui-fg-interactive"
          >
            Vista previa ↗
          </a>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {/* Puck's "Publish" dispara onPublish → guarda puck_data. El status se
            maneja desde el listado. `key` fuerza remount al aplicar la IA. */}
        <Puck
          key={puckKey}
          config={config}
          data={currentData}
          onPublish={handleSave}
          overrides={{ headerActions: () => <PuckSaveButton /> }}
        />
      </div>

      <Drawer open={aiOpen} onOpenChange={setAiOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Generar landing con IA</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ai-brief">Brief *</Label>
              <Textarea
                id="ai-brief"
                placeholder="Ej: Landing de Black Friday para indumentaria urbana, con productos destacados y FAQ."
                rows={3}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ai-goal">Objetivo</Label>
                <Input id="ai-goal" placeholder="ventas" value={goal} onChange={(e) => setGoal(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ai-tone">Tono</Label>
                <Input id="ai-tone" placeholder="premium, directo" value={tone} onChange={(e) => setTone(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ai-audience">Audiencia</Label>
                <Input
                  id="ai-audience"
                  placeholder="clientes recurrentes"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ai-locale">Idioma</Label>
                <Input id="ai-locale" value={aiLocale} onChange={(e) => setAiLocale(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Modo</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as AiMode)}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="replace">Reemplazar todo</Select.Item>
                  <Select.Item value="append">Agregar al final</Select.Item>
                  <Select.Item value="draft_only">Solo previsualizar (no guarda)</Select.Item>
                </Select.Content>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Componentes a priorizar (opcional)</Label>
              <div className="grid grid-cols-2 gap-2">
                {AI_COMPONENTS.map((name) => (
                  <Label
                    key={name}
                    className="flex cursor-pointer items-center gap-2 font-normal"
                  >
                    <Checkbox
                      checked={components.includes(name)}
                      onCheckedChange={() => toggleComponent(name)}
                    />
                    {name}
                  </Label>
                ))}
              </div>
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              Se aplica sobre el contenido guardado; los cambios sin guardar del editor se reemplazan.
            </Text>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">{t('CANCEL')}</Button>
            </Drawer.Close>
            <Button onClick={handleGenerate} isLoading={generateMut.isPending}>
              Generar
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Drawer open={!!promptCfg} onOpenChange={(open) => !open && closePrompt()}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{promptCfg?.title}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-3">
            {promptCfg?.description ? (
              <Text size="small" className="text-ui-fg-subtle">
                {promptCfg.description}
              </Text>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="prompt-input">{promptCfg?.label}</Label>
              {promptCfg?.multiline ? (
                <Textarea
                  id="prompt-input"
                  rows={3}
                  autoFocus
                  placeholder={promptCfg?.placeholder}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                />
              ) : (
                <Input
                  id="prompt-input"
                  autoFocus
                  placeholder={promptCfg?.placeholder}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      confirmPrompt();
                    }
                  }}
                />
              )}
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" onClick={closePrompt}>
              {t('CANCEL')}
            </Button>
            <Button onClick={confirmPrompt}>{promptCfg?.confirmText ?? 'Aplicar'}</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Toaster />
    </div>
  );
};

type DetailLoaderData = { breadcrumb: string };

// Resolve the landing page title for the breadcrumb ("Landings › <título>")
// instead of the raw id. Falls back to the id if the fetch fails.
export async function loader({ params }: LoaderFunctionArgs): Promise<DetailLoaderData> {
  const id = params.id ?? '';
  if (id === 'new') return { breadcrumb: 'Nueva landing' };
  try {
    const { landing_page } = await sdk.client.fetch<{ landing_page: { title?: string } }>(
      `/admin/landing-pages/${id}`,
      { method: 'GET' },
    );
    return { breadcrumb: landing_page?.title ?? id };
  } catch {
    return { breadcrumb: id };
  }
}

export const handle = {
  breadcrumb: ({ data }: UIMatch<DetailLoaderData>) => data?.breadcrumb ?? '',
};

export default LandingPageEditor;
