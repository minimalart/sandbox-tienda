import { Input, Label, Select, Switch, Text, Textarea } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { CampaignContentFields } from './campaign-content-fields';
import { BranchTypesField } from './branch-types-field';
import { LocationZonesField } from './location-zones-field';
import { MenuConfigField } from './menu-config-field';
import type { ContentConfigForm } from './content-config-form';

// Re-export para no tocar a los importadores (demo-store-create / demo-store-edit):
// la lógica se mudó a `content-config-form.ts` para poder testearla.
export {
  contentConfigToForm,
  DEFAULT_SUCURSALES_SUBTITLE,
  emptyContentForm,
  formToContentConfig,
} from './content-config-form';
export type { ContentConfigForm, MobileNavSlotId } from './content-config-form';

type Props = {
  value: ContentConfigForm;
  onChange: (value: ContentConfigForm) => void;
  templateCode: string;
};

/** Shared "Contenido" fields for the demo create wizard + edit drawer. */
export const ContentConfigFields = ({ value, onChange, templateCode }: Props) => {
  const { t } = useTranslation('demo-stores');

  const setSection = (key: keyof ContentConfigForm['sections'], checked: boolean) =>
    onChange({ ...value, sections: { ...value.sections, [key]: checked } });

  const setSuggestion = (index: number, field: 'label' | 'query', v: string) =>
    onChange({
      ...value,
      searchSuggestions: value.searchSuggestions.map((s, i) =>
        i === index ? { ...s, [field]: v } : s,
      ),
    });

  /**
   * Lo que NO es menú: el link del footer y las etiquetas de las cards. Todo lo
   * que sí es menú —incluidos Blog, Contacto y Sucursales, que antes estaban
   * acá— vive en `MenuConfigField`, con su visibilidad y su lugar en la barra
   * mobile en la misma fila.
   */
  const toggleRows: Array<{
    key: keyof ContentConfigForm['sections'];
    label: string;
  }> = [
    { key: 'corporate', label: t('CONTENT_CORPORATE_TOGGLE') },
    { key: 'variantLabels', label: t('CONTENT_VARIANT_LABELS_TOGGLE') },
  ];

  return (
    <div className="flex flex-col gap-y-6">
      {/* Menú: visibilidad, orden en la barra mobile e ícono/texto, por entrada. */}
      <MenuConfigField value={value} onChange={onChange} />

      <div className="flex flex-col gap-y-4">
        <Text size="small" weight="plus">
          {t('CONTENT_CART_TITLE')}
        </Text>
        <div className="flex items-center justify-between gap-4">
          <Label>{t('CONTENT_CART_RECOMMENDATIONS_TOGGLE')}</Label>
          <Switch
            className="shrink-0"
            checked={value.cartRecommendationsCarousel}
            onCheckedChange={(checked) =>
              onChange({ ...value, cartRecommendationsCarousel: checked })
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-y-4">
        <Text size="small" weight="plus">
          {t('CONTENT_SECTIONS_TITLE')}
        </Text>
        {toggleRows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <Label>{row.label}</Label>
            <Switch
              className="shrink-0"
              checked={value.sections[row.key]}
              onCheckedChange={(checked) => setSection(row.key, checked)}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-y-2">
        <Label>{t('CONTENT_BLOG_NAME')}</Label>
        <Input
          value={value.blogSectionName}
          placeholder={t('CONTENT_BLOG_NAME_PLACEHOLDER')}
          onChange={(e) => onChange({ ...value, blogSectionName: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-y-2">
        <Label>{t('CONTENT_BRANDS_LAYOUT')}</Label>
        <Select
          value={value.brandsLayout}
          onValueChange={(v) =>
            onChange({ ...value, brandsLayout: v as ContentConfigForm['brandsLayout'] })
          }
        >
          <Select.Trigger>
            <Select.Value placeholder={t('CONTENT_BRANDS_LAYOUT')} />
          </Select.Trigger>
          {/* z-[60]: el Content abre detrás del Drawer (z-50) si no se sube. */}
          <Select.Content className="z-[60]">
            <Select.Item value="carousel">
              {t('CONTENT_BRANDS_LAYOUT_CAROUSEL')}
            </Select.Item>
            <Select.Item value="marquee">{t('CONTENT_BRANDS_LAYOUT_MARQUEE')}</Select.Item>
            <Select.Item value="dots">{t('CONTENT_BRANDS_LAYOUT_DOTS')}</Select.Item>
          </Select.Content>
        </Select>
      </div>

      <div className="flex flex-col gap-y-2">
        <Label>{t('CONTENT_MP_CHECKOUT_MODE')}</Label>
        <Select
          value={value.mercadopagoCheckoutMode}
          onValueChange={(v) =>
            onChange({
              ...value,
              mercadopagoCheckoutMode: v as ContentConfigForm['mercadopagoCheckoutMode'],
            })
          }
        >
          <Select.Trigger>
            <Select.Value placeholder={t('CONTENT_MP_CHECKOUT_MODE')} />
          </Select.Trigger>
          {/* z-[60]: el Content abre detrás del Drawer (z-50) si no se sube. */}
          <Select.Content className="z-[60]">
            <Select.Item value="express">{t('CONTENT_MP_MODE_EXPRESS')}</Select.Item>
            <Select.Item value="api">{t('CONTENT_MP_MODE_API')}</Select.Item>
            <Select.Item value="both">{t('CONTENT_MP_MODE_BOTH')}</Select.Item>
          </Select.Content>
        </Select>
      </div>

      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col">
          <Text size="small" weight="plus">
            {t('CONTENT_SUCURSALES_TITLE')}
          </Text>
        </div>
        <div className="flex flex-col gap-y-2">
          <Label>{t('CONTENT_SUCURSALES_SUBTITLE')}</Label>
          <Textarea
            value={value.sucursalesSubtitle}
            placeholder={t('CONTENT_SUCURSALES_SUBTITLE_PLACEHOLDER')}
            rows={2}
            onChange={(e) => onChange({ ...value, sucursalesSubtitle: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label>{t('CONTENT_SUCURSALES_LAYOUT')}</Label>
          <Select
            value={value.sucursalesLayout}
            onValueChange={(v) =>
              onChange({
                ...value,
                sucursalesLayout: v as ContentConfigForm['sucursalesLayout'],
              })
            }
          >
            <Select.Trigger>
              <Select.Value placeholder={t('CONTENT_SUCURSALES_LAYOUT')} />
            </Select.Trigger>
            {/* z-[60]: el Content abre detrás del Drawer (z-50) si no se sube. */}
            <Select.Content className="z-[60]">
              <Select.Item value="full">{t('CONTENT_SUCURSALES_LAYOUT_FULL')}</Select.Item>
              <Select.Item value="compact">
                {t('CONTENT_SUCURSALES_LAYOUT_COMPACT')}
              </Select.Item>
            </Select.Content>
          </Select>
        </div>
        <BranchTypesField
          value={value.sucursalesTypes}
          onChange={(sucursalesTypes) => onChange({ ...value, sucursalesTypes })}
        />
        <LocationZonesField
          value={value.sucursalesRegions ?? []}
          onChange={(sucursalesRegions) => onChange({ ...value, sucursalesRegions })}
        />
        {/* En el layout compacto no hay buscador ni filtros: los toggles no aplican. */}
        {value.sucursalesLayout === 'full' && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <Label>{t('CONTENT_SUCURSALES_LOCATION_FILTERS')}</Label>
              </div>
              <Switch
                className="shrink-0"
                checked={value.sucursalesShowLocationFilters}
                onCheckedChange={(checked) =>
                  onChange({ ...value, sucursalesShowLocationFilters: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <Label>{t('CONTENT_SUCURSALES_CATEGORY_FILTERS')}</Label>
              </div>
              <Switch
                className="shrink-0"
                checked={value.sucursalesShowCategoryFilters}
                onCheckedChange={(checked) =>
                  onChange({ ...value, sucursalesShowCategoryFilters: checked })
                }
              />
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col">
          <Text size="small" weight="plus">
            {t('CONTENT_CONTACT_TITLE')}
          </Text>
        </div>
        <div className="flex flex-col gap-y-2">
          <Label>{t('CONTENT_CONTACT_ADDRESS')}</Label>
          <Input
            value={value.contactAddress}
            placeholder={t('CONTENT_CONTACT_ADDRESS_PLACEHOLDER')}
            onChange={(e) => onChange({ ...value, contactAddress: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label>{t('CONTENT_CONTACT_PHONE')}</Label>
          <Input
            value={value.contactPhone}
            placeholder={t('CONTENT_CONTACT_PHONE_PLACEHOLDER')}
            onChange={(e) => onChange({ ...value, contactPhone: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label>{t('CONTENT_CONTACT_EMAIL')}</Label>
          <Input
            value={value.contactEmail}
            placeholder={t('CONTENT_CONTACT_EMAIL_PLACEHOLDER')}
            onChange={(e) => onChange({ ...value, contactEmail: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label>{t('CONTENT_CONTACT_HOURS')}</Label>
          <Input
            value={value.contactHours}
            placeholder={t('CONTENT_CONTACT_HOURS_PLACEHOLDER')}
            onChange={(e) => onChange({ ...value, contactHours: e.target.value })}
          />
        </div>
        {/*
          Copy de la tarjeta "Atención al cliente" de /contact. Va acá, pegado a
          los datos que la misma tarjeta muestra (dirección, teléfono, mail), y no
          en una pantalla aparte: partirlo habría dejado el título en un lugar y el
          teléfono en otro.

          Los placeholders son el copy POR DEFECTO del storefront, así que se ve
          qué queda si el campo se deja vacío.
        */}
        <div className="flex flex-col pt-2">
          <Text size="small" weight="plus">
            {t('CONTENT_CONTACT_PAGE_TITLE')}
          </Text>
        </div>
        <div className="flex flex-col gap-y-2">
          <Label>{t('CONTENT_CONTACT_PAGE_HEADING')}</Label>
          <Input
            value={value.contactPageTitle}
            placeholder={t('CONTENT_CONTACT_PAGE_HEADING_PLACEHOLDER')}
            onChange={(e) => onChange({ ...value, contactPageTitle: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label>{t('CONTENT_CONTACT_PAGE_DESCRIPTION')}</Label>
          <Textarea
            rows={3}
            value={value.contactPageDescription}
            placeholder={t('CONTENT_CONTACT_PAGE_DESCRIPTION_PLACEHOLDER')}
            onChange={(e) =>
              onChange({ ...value, contactPageDescription: e.target.value })
            }
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label>{t('CONTENT_CONTACT_PAGE_NOTE')}</Label>
          <Textarea
            rows={2}
            value={value.contactPageNote}
            placeholder={t('CONTENT_CONTACT_PAGE_NOTE_PLACEHOLDER')}
            onChange={(e) => onChange({ ...value, contactPageNote: e.target.value })}
          />
        </div>
      </div>

      {/*
        El footer NO se edita acá: es un puntero, no una sección con campos. La
        descripción vivía en esta ficha hasta DESDEELSUR-18 y editarla en dos
        pantallas era una invitación a pisarse; sin el cartel, el campo
        simplemente desaparecería sin decir a dónde se fue.
      */}
      <div className="flex flex-col">
        <Text size="small" weight="plus">
          {t('CONTENT_FOOTER_TITLE')}
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          {t('CONTENT_FOOTER_HELP')}
        </Text>
      </div>

      <div className="flex flex-col gap-y-2">
        <Label>{t('CONTENT_SL_TITLE')}</Label>
        <Input
          value={value.shoppingListTitle}
          placeholder={t('CONTENT_SL_TITLE_PLACEHOLDER')}
          onChange={(e) => onChange({ ...value, shoppingListTitle: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <Label>{t('CONTENT_SL_SUBTITLE')}</Label>
        <Input
          value={value.shoppingListSubtitle}
          placeholder={t('CONTENT_SL_SUBTITLE_PLACEHOLDER')}
          onChange={(e) => onChange({ ...value, shoppingListSubtitle: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <Label>{t('CONTENT_SL_QUICK_TERMS')}</Label>
        <Textarea
          value={value.shoppingListQuickTerms}
          placeholder={t('CONTENT_SL_QUICK_TERMS_PLACEHOLDER')}
          rows={4}
          onChange={(e) =>
            onChange({ ...value, shoppingListQuickTerms: e.target.value })
          }
        />
      </div>

      {templateCode === 'supermercado' && (
        <div className="flex flex-col gap-y-2">
          <Label>{t('CONTENT_SEARCH_SUGGESTIONS')}</Label>
          {value.searchSuggestions.map((s, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <Input
                value={s.label}
                placeholder={t('CONTENT_SUGGESTION_LABEL')}
                onChange={(e) => setSuggestion(i, 'label', e.target.value)}
              />
              <Input
                value={s.query}
                placeholder={t('CONTENT_SUGGESTION_QUERY')}
                onChange={(e) => setSuggestion(i, 'query', e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-y-2">
        <Label>{t('CONTENT_SEARCH_HINTS')}</Label>
        <Textarea
          value={value.searchHints}
          placeholder={t('CONTENT_SEARCH_HINTS_PLACEHOLDER')}
          rows={4}
          onChange={(e) => onChange({ ...value, searchHints: e.target.value })}
        />
      </div>

      {templateCode === 'campaign' && (
        <CampaignContentFields value={value} onChange={onChange} />
      )}
    </div>
  );
};
