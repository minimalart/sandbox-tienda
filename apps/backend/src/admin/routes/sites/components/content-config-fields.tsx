import {
  IconButton,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Textarea,
  Tooltip,
} from '@medusajs/ui';
import { ArrowDownMini, ArrowUpMini } from '@medusajs/icons';
import { useTranslation } from 'react-i18next';
import { CampaignContentFields } from './campaign-content-fields';
import type { ContentConfigForm, MobileNavSlotId } from './content-config-form';

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

/**
 * Label + ayuda de cada candidato de la barra inferior mobile. La clave de la
 * ayuda dice de qué depende que el candidato esté DISPONIBLE, porque el orden es
 * una preferencia y no una garantía: el storefront salta al siguiente cuando el
 * gate del primero no se cumple.
 */
const MOBILE_NAV_LABELS: Record<MobileNavSlotId, { label: string; help: string }> = {
  promos: { label: 'MOBILE_NAV_PROMOS', help: 'MOBILE_NAV_PROMOS_HELP' },
  colores: { label: 'MOBILE_NAV_COLORES', help: 'MOBILE_NAV_COLORES_HELP' },
  sucursales: { label: 'MOBILE_NAV_SUCURSALES', help: 'MOBILE_NAV_SUCURSALES_HELP' },
  blog: { label: 'MOBILE_NAV_BLOG', help: 'MOBILE_NAV_BLOG_HELP' },
  contacto: { label: 'MOBILE_NAV_CONTACTO', help: 'MOBILE_NAV_CONTACTO_HELP' },
};

/**
 * Mueve `from` a `to` devolviendo un array nuevo.
 *
 * `slice(from, from + 1)` y no `splice(...)[0]`: con `noUncheckedIndexedAccess`
 * el elemento sacado es `T | undefined` y no se puede volver a insertar sin un
 * cast. El slice es un `T[]` y el spread queda bien tipado.
 */
const move = <T,>(rows: T[], from: number, to: number): T[] => {
  const next = rows.filter((_, i) => i !== from);
  next.splice(to, 0, ...rows.slice(from, from + 1));
  return next;
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

  const toggleRows: Array<{
    key: keyof ContentConfigForm['sections'];
    label: string;
    help: string;
  }> = [
    {
      key: 'categories',
      label: t('CONTENT_CATEGORIES_TOGGLE'),
      help: t('CONTENT_CATEGORIES_TOGGLE_HELP'),
    },
    { key: 'blog', label: t('CONTENT_BLOG_TOGGLE'), help: t('CONTENT_BLOG_TOGGLE_HELP') },
    {
      key: 'contact',
      label: t('CONTENT_CONTACT_TOGGLE'),
      help: t('CONTENT_CONTACT_TOGGLE_HELP'),
    },
    {
      key: 'shoppingList',
      label: t('CONTENT_SHOPPING_LIST_TOGGLE'),
      help: t('CONTENT_SHOPPING_LIST_TOGGLE_HELP'),
    },
    {
      key: 'sucursales',
      label: t('CONTENT_SUCURSALES_TOGGLE'),
      help: t('CONTENT_SUCURSALES_TOGGLE_HELP'),
    },
    {
      key: 'corporate',
      label: t('CONTENT_CORPORATE_TOGGLE'),
      help: t('CONTENT_CORPORATE_TOGGLE_HELP'),
    },
    {
      key: 'variantLabels',
      label: t('CONTENT_VARIANT_LABELS_TOGGLE'),
      help: t('CONTENT_VARIANT_LABELS_TOGGLE_HELP'),
    },
  ];

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-4">
        <Text size="small" weight="plus">
          {t('CONTENT_SECTIONS_TITLE')}
        </Text>
        {toggleRows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <Label>{row.label}</Label>
              <Text size="small" className="text-ui-fg-subtle">
                {row.help}
              </Text>
            </div>
            <Switch
              className="shrink-0"
              checked={value.sections[row.key]}
              onCheckedChange={(checked) => setSection(row.key, checked)}
            />
          </div>
        ))}
      </div>

      {/* Si el menú de categorías está apagado, la variante visual no aplica. */}
      {value.sections.categories && (
        <div className="flex flex-col gap-y-2">
          <Label>{t('CONTENT_CATEGORIES_LAYOUT')}</Label>
          <Text size="small" className="text-ui-fg-subtle">
            {t('CONTENT_CATEGORIES_LAYOUT_HELP')}
          </Text>
          <Select
            value={value.categoriesMenuLayout}
            onValueChange={(v) =>
              onChange({
                ...value,
                categoriesMenuLayout: v as ContentConfigForm['categoriesMenuLayout'],
              })
            }
          >
            <Select.Trigger>
              <Select.Value placeholder={t('CONTENT_CATEGORIES_LAYOUT')} />
            </Select.Trigger>
            {/* z-[60]: el Content abre detrás del Drawer (z-50) si no se sube. */}
            <Select.Content className="z-[60]">
              <Select.Item value="hamburger">
                {t('CONTENT_CATEGORIES_LAYOUT_HAMBURGER')}
              </Select.Item>
              <Select.Item value="button">
                {t('CONTENT_CATEGORIES_LAYOUT_BUTTON')}
              </Select.Item>
            </Select.Content>
          </Select>
        </div>
      )}

      {/*
        Barra inferior mobile. El cuarto lugar (entre el carrito y el menú) era
        "Promos" fijo, y "Promos" se apaga solo cuando el canal no tiene
        promociones activas: la barra caía a 4 columnas y el carrito, que es el
        botón redondo del centro, quedaba descentrado. Acá se ordenan los
        candidatos; el storefront usa el primero que esté disponible.
      */}
      <div className="flex flex-col gap-y-2">
        <Label>{t('MOBILE_NAV_TITLE')}</Label>
        <Text size="small" className="text-ui-fg-subtle">
          {t('MOBILE_NAV_HELP')}
        </Text>
        <div className="flex flex-col gap-y-1">
          {value.mobileNav.map((id, index) => (
            <div
              key={id}
              className="flex items-center gap-2 rounded-md border border-ui-border-base px-3 py-2"
            >
              <Text size="small" className="w-4 shrink-0 text-ui-fg-muted">
                {index + 1}
              </Text>
              <div className="flex min-w-0 flex-col">
                <Text size="small" weight="plus">
                  {t(MOBILE_NAV_LABELS[id].label)}
                </Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {t(MOBILE_NAV_LABELS[id].help)}
                </Text>
              </div>
              <div className="ml-auto flex shrink-0 items-center">
                <Tooltip content={t('MOBILE_NAV_MOVE_UP')}>
                  <IconButton
                    type="button"
                    size="small"
                    variant="transparent"
                    disabled={index === 0}
                    onClick={() =>
                      onChange({
                        ...value,
                        mobileNav: move(value.mobileNav, index, index - 1),
                      })
                    }
                  >
                    <ArrowUpMini />
                  </IconButton>
                </Tooltip>
                <Tooltip content={t('MOBILE_NAV_MOVE_DOWN')}>
                  <IconButton
                    type="button"
                    size="small"
                    variant="transparent"
                    disabled={index === value.mobileNav.length - 1}
                    onClick={() =>
                      onChange({
                        ...value,
                        mobileNav: move(value.mobileNav, index, index + 1),
                      })
                    }
                  >
                    <ArrowDownMini />
                  </IconButton>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
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
        <Text size="small" className="text-ui-fg-subtle">
          {t('CONTENT_BRANDS_LAYOUT_HELP')}
        </Text>
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
        <Text size="small" className="text-ui-fg-subtle">
          {t('CONTENT_MP_CHECKOUT_MODE_HELP')}
        </Text>
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
          <Text size="small" className="text-ui-fg-subtle">
            {t('CONTENT_SUCURSALES_HELP')}
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
          <Text size="xsmall" className="text-ui-fg-subtle">
            {t('CONTENT_SUCURSALES_SUBTITLE_HELP')}
          </Text>
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
          <Text size="xsmall" className="text-ui-fg-subtle">
            {t('CONTENT_SUCURSALES_LAYOUT_HELP')}
          </Text>
        </div>
        {/* En el layout compacto no hay buscador ni filtros: los toggles no aplican. */}
        {value.sucursalesLayout === 'full' && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <Label>{t('CONTENT_SUCURSALES_LOCATION_FILTERS')}</Label>
                <Text size="small" className="text-ui-fg-subtle">
                  {t('CONTENT_SUCURSALES_LOCATION_FILTERS_HELP')}
                </Text>
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
                <Text size="small" className="text-ui-fg-subtle">
                  {t('CONTENT_SUCURSALES_CATEGORY_FILTERS_HELP')}
                </Text>
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
          <Text size="small" className="text-ui-fg-subtle">
            {t('CONTENT_CONTACT_HELP')}
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
          <Text size="small" className="text-ui-fg-subtle">
            {t('CONTENT_CONTACT_PAGE_HELP')}
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
        <Text size="xsmall" className="text-ui-fg-subtle">
          {t('CONTENT_SL_QUICK_TERMS_HELP')}
        </Text>
      </div>

      {templateCode === 'supermercado' && (
        <div className="flex flex-col gap-y-2">
          <Label>{t('CONTENT_SEARCH_SUGGESTIONS')}</Label>
          <Text size="small" className="text-ui-fg-subtle">
            {t('CONTENT_SEARCH_SUGGESTIONS_HELP')}
          </Text>
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
        <Text size="xsmall" className="text-ui-fg-subtle">
          {t('CONTENT_SEARCH_HINTS_HELP')}
        </Text>
      </div>

      {templateCode === 'campaign' && (
        <CampaignContentFields value={value} onChange={onChange} />
      )}
    </div>
  );
};
