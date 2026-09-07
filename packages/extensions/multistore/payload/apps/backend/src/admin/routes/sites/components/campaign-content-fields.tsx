import { Input, Label, Text, Textarea } from '@medusajs/ui';
import type { ContentConfigForm } from './content-config-form';

/**
 * Overrides SITE-LEVEL del template Campaña (landing institucional).
 *
 * Se monta desde `ContentConfigFields` sólo cuando `templateCode === 'campaign'`.
 * Cubre lo que aparece en TODAS las pantallas del sitio (no sólo la home):
 *
 *  - Barra de anuncio (arriba del header, cross-page).
 *  - Chrome del header (subtítulo institucional + pill "Powered by").
 *  - Footer institucional (descripción, dirección física, email, copyright, "Powered by").
 *
 * El CUERPO de la home (hero + grid de kits) NO vive acá: se edita como
 * bloques Puck en el editor de home del site (`home_puck_data`, con bloques
 * `CampaignHero` y `ProductosDestacados`). Ese split sigue el mismo patrón
 * que los verticals existentes (grocery, technology, fashion, …).
 *
 * Los DATOS del footer institucional (address, email) intencionalmente NO viven
 * en `content_config.contact` — el template renderiza el footer directamente
 * desde `assets.campaign.footer`, sin acoplar a la pantalla "Personalizar
 * footer" que asume secciones (redes, legales, newsletter) que NO existen acá.
 *
 * Los placeholders muestran el default de `campaignConfig` para que el operador
 * vea qué está pisando si escribe. Vaciar un input = vuelve al default.
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
      <div className="flex flex-col gap-y-2">
        <Text size="base" weight="plus">
          Landing institucional (Campaña)
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          Overrides que aplican a todas las pantallas del sitio. El cuerpo de la
          home (hero, grid de kits) se edita como bloques en "Personalizar home".
        </Text>
      </div>

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
              placeholder="Powered by EDUCABOT"
              onChange={(e) =>
                set('campaignChromePoweredByLabel', e.target.value)
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Pill "Powered by" — link</Label>
            <Input
              value={value.campaignChromePoweredByHref}
              placeholder="https://educabot.com"
              onChange={(e) =>
                set('campaignChromePoweredByHref', e.target.value)
              }
            />
          </div>
        </div>
      </section>

      {/* ─── Footer institucional ───────────────────────────────────────── */}
      <section className="flex flex-col gap-y-3">
        <Text size="small" weight="plus">
          Footer institucional
        </Text>
        <div className="flex flex-col gap-y-2">
          <Label>Descripción / párrafo bajo el nombre</Label>
          <Textarea
            rows={2}
            value={value.campaignFooterDescription}
            placeholder="Tienda de kits educativos gestionada junto a Educabot…"
            onChange={(e) => set('campaignFooterDescription', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-y-2">
            <Label>Dirección física</Label>
            <Input
              value={value.campaignFooterAddress}
              placeholder="Av. Siempre Viva 1234, Buenos Aires"
              onChange={(e) => set('campaignFooterAddress', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Email de contacto</Label>
            <Input
              type="email"
              value={value.campaignFooterEmail}
              placeholder="tienda@escuela.edu.ar"
              onChange={(e) => set('campaignFooterEmail', e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-y-2">
          <Label>Copyright</Label>
          <Input
            value={value.campaignFooterCopyright}
            placeholder="© 2026 Institución"
            onChange={(e) => set('campaignFooterCopyright', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-y-2">
            <Label>"Powered by" del footer — texto</Label>
            <Input
              value={value.campaignFooterPoweredByLabel}
              placeholder="Plataforma provista por EDUCABOT"
              onChange={(e) =>
                set('campaignFooterPoweredByLabel', e.target.value)
              }
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>"Powered by" del footer — link</Label>
            <Input
              value={value.campaignFooterPoweredByHref}
              placeholder="https://educabot.com"
              onChange={(e) =>
                set('campaignFooterPoweredByHref', e.target.value)
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
};
