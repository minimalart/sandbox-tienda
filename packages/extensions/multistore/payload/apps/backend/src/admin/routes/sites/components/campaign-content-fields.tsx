import { Input, Label, Text } from '@medusajs/ui';
import { ImageField } from '../../../components/image-field';
import type { ContentConfigForm } from './content-config-form';

/**
 * Overrides SITE-LEVEL del template Campaña (landing institucional).
 *
 * Se monta desde `ContentConfigFields` sólo cuando `templateCode === 'campaign'`.
 * Cubre la barra de anuncio (cross-page), el chrome del header y los ajustes
 * propios del footer del vertical (crédito "Powered by" + color de fondo).
 *
 * Los DATOS del footer (dirección, email, teléfono, descripción y copyright)
 * salen de las fuentes compartidas del site: se editan desde "Personalizar
 * Footer" (descripción, copyright) y desde los campos de Contacto de la
 * tienda (dirección, email, teléfono).
 */

type Props = {
  value: ContentConfigForm;
  onChange: (value: ContentConfigForm) => void;
};

export const CampaignContentFields = ({ value, onChange }: Props) => {
  const set = <K extends keyof ContentConfigForm>(
    key: K,
    v: ContentConfigForm[K],
  ) => onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-col gap-y-8 rounded-lg border border-ui-border-base p-4">
      <Text size="base" weight="plus">
        Landing institucional (Campaña)
      </Text>

      {/* ─── Announcement bar ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-y-3">
        <Text size="small" weight="plus">
          Barra de anuncio (arriba del header)
        </Text>
        <div className="flex flex-col gap-y-2">
          <Label>Texto</Label>
          <Input
            value={value.campaignAnnouncementText}
            placeholder="Tienda oficial · comprá como invitado, sin registrarte"
            onChange={(e) => set('campaignAnnouncementText', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label>Link (opcional)</Label>
          <Input
            value={value.campaignAnnouncementHref}
            placeholder="https://…"
            onChange={(e) => set('campaignAnnouncementHref', e.target.value)}
          />
        </div>
      </section>

      {/* ─── Chrome (header) ────────────────────────────────────────────── */}
      <section className="flex flex-col gap-y-3">
        <Text size="small" weight="plus">
          Header (chrome)
        </Text>
        <div className="flex flex-col gap-y-2">
          <Label>Subtítulo bajo el nombre (ej: "TIENDA OFICIAL")</Label>
          <Input
            value={value.campaignChromeSubtitle}
            placeholder="TIENDA OFICIAL"
            onChange={(e) => set('campaignChromeSubtitle', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-y-2">
            <Label>Pill "Powered by" — texto</Label>
            <Input
              value={value.campaignChromePoweredByLabel}
              placeholder="Powered by NOMBRETIENDA"
              onChange={(e) =>
                set('campaignChromePoweredByLabel', e.target.value)
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Pill "Powered by" — link</Label>
            <Input
              value={value.campaignChromePoweredByHref}
              placeholder="https://nombretienda.com"
              onChange={(e) =>
                set('campaignChromePoweredByHref', e.target.value)
              }
            />
          </div>
        </div>
        <div className="flex flex-col gap-y-2">
          <ImageField
            label='Pill "Powered by" — logo'
            value={value.campaignChromePoweredByImage}
            onChange={(v) => set('campaignChromePoweredByImage', v)}
            help='Si cargás un logo, se muestra en vez del texto. Alto máx. sugerido: 28 px.'
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label>Color de fondo del header (hex)</Label>
          <Input
            value={value.campaignChromeBackgroundColor}
            placeholder="#ffffff"
            onChange={(e) =>
              set('campaignChromeBackgroundColor', e.target.value)
            }
          />
        </div>
      </section>

      {/* ─── Footer (ajustes propios del vertical) ──────────────────────── */}
      <section className="flex flex-col gap-y-3">
        <Text size="small" weight="plus">
          Footer
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          La descripción y el copyright del footer se editan en "Personalizar
          Footer". La dirección, el email y el teléfono se editan en los campos
          de Contacto de la tienda.
        </Text>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-y-2">
            <Label>"Powered by" del footer — texto</Label>
            <Input
              value={value.campaignFooterPoweredByLabel}
              placeholder="Plataforma provista por NOMBRETIENDA"
              onChange={(e) =>
                set('campaignFooterPoweredByLabel', e.target.value)
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>"Powered by" del footer — link</Label>
            <Input
              value={value.campaignFooterPoweredByHref}
              placeholder="https://nombretienda.com"
              onChange={(e) =>
                set('campaignFooterPoweredByHref', e.target.value)
              }
            />
          </div>
        </div>
        <div className="flex flex-col gap-y-2">
          <ImageField
            label='"Powered by" del footer — logo'
            value={value.campaignFooterPoweredByImage}
            onChange={(v) => set('campaignFooterPoweredByImage', v)}
            help='Si cargás un logo, se muestra en vez del texto. Alto máx. sugerido: 28 px.'
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label>Color de fondo del footer (hex)</Label>
          <Input
            value={value.campaignFooterBackgroundColor}
            placeholder="#ffffff"
            onChange={(e) =>
              set('campaignFooterBackgroundColor', e.target.value)
            }
          />
        </div>
      </section>
    </div>
  );
};
