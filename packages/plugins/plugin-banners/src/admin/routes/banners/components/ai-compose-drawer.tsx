import {
  Button,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from '@medusajs/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductSelector } from '../../../components/blog/product-selector';
import { useComposeBannerAI, type ComposedBanner } from '../../../hooks/api/banners';
import { registerBannersTranslations } from '../../../translations/banners';
import { registerBlogTranslations } from '../../../translations/blog';
import { BannerPreview } from './banner-preview';
import { getPlacementConfig, PLACEMENT_CONFIG, PLACEMENT_IDS } from './placement-config';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Se llama con el "slide" generado y la ubicación elegida para pre-llenar el form. */
  onComposed: (result: ComposedBanner, placement: string) => void;
};

const DEFAULT_PLACEMENT = PLACEMENT_IDS.includes('banner_1')
  ? 'banner_1'
  : (PLACEMENT_IDS[0] ?? 'banner_1');

/**
 * Aspect ratio de la imagen generada según el placement: el hero (banner_1) es
 * bien panorámico (evita que la imagen "quede corta" al cubrir el contenedor),
 * el splash es vertical, el resto horizontal estándar.
 */
function aspectForPlacement(placement: string): '21:9' | '16:9' | '9:16' {
  if (placement === 'welcome_splash') return '9:16';
  if (placement === 'banner_1') return '21:9';
  return '16:9';
}

/**
 * Drawer de "Generar con IA": junta contexto (brief + objetivo/tono/audiencia) y
 * PRODUCTOS (reusa el selector del blog, con miniaturas), y en una sola llamada
 * genera copy + imagen. Las fotos de los productos viajan como referencia para
 * que aparezcan en el banner sin deformarse. Al terminar, delega en `onComposed`
 * para abrir el editor de banner ya pre-cargado.
 */
export function AiComposeDrawer({ open, onClose, onComposed }: Props) {
  const { t, i18n } = useTranslation('banners');
  registerBannersTranslations(i18n);
  registerBlogTranslations(i18n);

  const [placement, setPlacement] = useState<string>(DEFAULT_PLACEMENT);
  const [brief, setBrief] = useState('');
  const [goal, setGoal] = useState('');
  const [tone, setTone] = useState('');
  const [audience, setAudience] = useState('');
  const [productIds, setProductIds] = useState<string[]>([]);

  const compose = useComposeBannerAI();
  const [result, setResult] = useState<ComposedBanner | null>(null);

  const reset = () => {
    setPlacement(DEFAULT_PLACEMENT);
    setBrief('');
    setGoal('');
    setTone('');
    setAudience('');
    setProductIds([]);
    setResult(null);
  };

  const close = () => {
    if (compose.isPending) return;
    reset();
    onClose();
  };

  // Genera (o regenera: mismos inputs → otra variante). No cierra el drawer:
  // muestra el preview para revisar y, si algo salió mal, volver a generar.
  const handleGenerate = async () => {
    if (!brief.trim()) return;
    try {
      const r = await compose.mutateAsync({
        brief: brief.trim(),
        goal: goal.trim() || undefined,
        tone: tone.trim() || undefined,
        audience: audience.trim() || undefined,
        placement,
        aspectRatio: aspectForPlacement(placement),
        productIds: productIds.length ? productIds : undefined,
      });
      if (r.warnings?.length) {
        toast.warning(t('AI_COMPOSE_WARN', { msg: r.warnings.join(' · ') }));
      } else {
        toast.success(t('AI_COMPOSE_DONE'));
      }
      setResult(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('AI_ERROR'));
    }
  };

  // Aplica el slide generado: abre el editor de banner ya pre-cargado.
  const handleUse = () => {
    if (!result) return;
    onComposed(result, placement);
    reset();
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && close()}>
      <Drawer.Content>
        <Drawer.Header>
          <Heading>{t('AI_COMPOSE_TITLE')}</Heading>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto p-4">
          <Text size="small" className="text-ui-fg-subtle">
            {t('AI_COMPOSE_SUBTITLE')}
          </Text>

          <div className="flex flex-col gap-1">
            <Label size="xsmall">{t('AI_COMPOSE_PLACEMENT')}</Label>
            <Select value={placement} onValueChange={setPlacement}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              {/* z-[60]: si no, el contenido abre detrás del Drawer (z-50). */}
              <Select.Content className="z-[60]">
                {PLACEMENT_IDS.map((id) => (
                  <Select.Item key={id} value={id}>
                    {t(PLACEMENT_CONFIG[id]!.labelKey)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label size="xsmall">{t('AI_BRIEF_LABEL')}</Label>
            <Textarea
              rows={3}
              placeholder={t('AI_BRIEF_PLACEHOLDER')}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input placeholder={t('AI_GOAL')} value={goal} onChange={(e) => setGoal(e.target.value)} />
            <Input placeholder={t('AI_TONE')} value={tone} onChange={(e) => setTone(e.target.value)} />
            <Input
              placeholder={t('AI_AUDIENCE')}
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label size="xsmall">{t('AI_COMPOSE_PRODUCTS_LABEL')}</Label>
            <ProductSelector value={productIds} onChange={setProductIds} />
            <Text size="xsmall" className="text-ui-fg-muted">
              {t('AI_COMPOSE_PRODUCTS_HELP')}
            </Text>
          </div>

          {result ? (
            <div className="flex flex-col gap-2 border-t border-ui-border-base pt-4">
              <Label size="xsmall">{t('AI_COMPOSE_PREVIEW')}</Label>
              <BannerPreview
                kind={getPlacementConfig(placement).preview}
                data={{
                  title: result.content.title || undefined,
                  subtitle: result.content.subtitle || undefined,
                  body: result.content.body || undefined,
                  mediaUrl: result.image_url || undefined,
                  ctaLabel: result.cta.label || undefined,
                  ctaUrl: result.cta.url || undefined,
                }}
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('AI_COMPOSE_PREVIEW_HELP')}
              </Text>
            </div>
          ) : null}
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" size="small" onClick={close} disabled={compose.isPending}>
            {t('BTN_CANCEL')}
          </Button>
          {result ? (
            <>
              <Button
                variant="secondary"
                size="small"
                onClick={handleGenerate}
                isLoading={compose.isPending}
                disabled={!brief.trim()}
              >
                {t('AI_COMPOSE_REGENERATE')}
              </Button>
              <Button size="small" onClick={handleUse} disabled={compose.isPending}>
                {t('AI_COMPOSE_USE')}
              </Button>
            </>
          ) : (
            <Button
              size="small"
              onClick={handleGenerate}
              isLoading={compose.isPending}
              disabled={!brief.trim()}
            >
              {t('AI_COMPOSE_GENERATE')}
            </Button>
          )}
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

export default AiComposeDrawer;
