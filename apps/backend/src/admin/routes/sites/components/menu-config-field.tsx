import { IconButton, Label, Select, Switch, Text } from '@medusajs/ui';
import { ArrowDownMini, ArrowUpMini } from '@medusajs/icons';
import { useTranslation } from 'react-i18next';
import type {
  ContentConfigForm,
  MobileNavDisplay,
  MobileNavSlotId,
} from './content-config-form';

/**
 * El MENÚ de la tienda, en un solo lugar.
 *
 * Antes cada entrada se configuraba en dos bloques distintos de esta misma
 * pantalla: los switches de "Secciones visibles" decidían si el link existe, y
 * más abajo "Barra inferior mobile" ordenaba los candidatos del lugar flexible.
 * O sea que Blog aparecía dos veces, y la fila de la barra tenía que explicar
 * "necesita el switch de Blog de arriba" — un cartel que sólo existía por estar
 * partido. Acá cada entrada es UNA fila con todo lo suyo: si se ve, en qué
 * posición entra a la barra y cómo se dibuja ahí.
 *
 * Dos cosas que la fila no puede prometer:
 *  - El ORDEN es una preferencia. La barra tiene un solo lugar flexible y toma
 *    el primer candidato realmente disponible, así que la posición 1 gana sólo
 *    si su gate se cumple.
 *  - `promos` y `colores` no tienen switch: dependen de datos de runtime
 *    (promociones activas en el canal, tintometría con carta importada), no de
 *    una preferencia de la ficha.
 */

/** Entradas del menú que pueden ocupar el lugar flexible de la barra mobile. */
const SLOT_LABELS: Record<MobileNavSlotId, string> = {
  promos: 'MOBILE_NAV_PROMOS',
  colores: 'MOBILE_NAV_COLORES',
  sucursales: 'MOBILE_NAV_SUCURSALES',
  blog: 'MOBILE_NAV_BLOG',
  contacto: 'MOBILE_NAV_CONTACTO',
};

/**
 * Qué switch de `sections` gobierna cada candidato. `promos` y `colores` no
 * tienen: su disponibilidad la decide el storefront con datos de runtime.
 */
const SLOT_SECTION: Partial<
  Record<MobileNavSlotId, keyof ContentConfigForm['sections']>
> = {
  sucursales: 'sucursales',
  blog: 'blog',
  contacto: 'contact',
};

/** Entradas del menú que NO van a la barra: sólo se prenden o se apagan. */
const MENU_ONLY: Array<{
  key: keyof ContentConfigForm['sections'];
  label: string;
}> = [
  { key: 'categories', label: 'CONTENT_CATEGORIES_TOGGLE' },
  { key: 'shoppingList', label: 'CONTENT_SHOPPING_LIST_TOGGLE' },
];

/** Mueve `from` a `to` devolviendo un array nuevo. */
const move = <T,>(rows: T[], from: number, to: number): T[] => {
  const next = rows.filter((_, i) => i !== from);
  next.splice(to, 0, ...rows.slice(from, from + 1));
  return next;
};

export const MenuConfigField = ({
  value,
  onChange,
}: {
  value: ContentConfigForm;
  onChange: (value: ContentConfigForm) => void;
}) => {
  const { t } = useTranslation('demo-stores');

  const setSection = (key: keyof ContentConfigForm['sections'], checked: boolean) =>
    onChange({ ...value, sections: { ...value.sections, [key]: checked } });

  const setDisplay = (id: MobileNavSlotId, display: MobileNavDisplay) =>
    onChange({
      ...value,
      mobileNavDisplay: { ...value.mobileNavDisplay, [id]: display },
    });

  return (
    <div className="flex flex-col gap-y-3">
      <Label>{t('MENU_TITLE')}</Label>

      <div className="flex flex-col gap-y-1">
        {value.mobileNav.map((id, index) => {
          const sectionKey = SLOT_SECTION[id];
          const label = t(SLOT_LABELS[id]);
          return (
            <div
              key={id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-ui-border-base px-3 py-2"
            >
              <Text size="small" className="w-4 shrink-0 text-ui-fg-muted">
                {index + 1}
              </Text>
              <Text size="small" weight="plus" className="min-w-[96px] flex-1">
                {label}
              </Text>

              {sectionKey ? (
                <Switch
                  className="shrink-0"
                  aria-label={label}
                  checked={value.sections[sectionKey]}
                  onCheckedChange={(checked) => setSection(sectionKey, checked)}
                />
              ) : (
                <Text size="small" className="shrink-0 text-ui-fg-muted">
                  {t('MENU_AUTO')}
                </Text>
              )}

              <Select
                value={value.mobileNavDisplay[id]}
                onValueChange={(next) => setDisplay(id, next as MobileNavDisplay)}
              >
                <Select.Trigger
                  className="w-[104px] shrink-0"
                  aria-label={t('MENU_DISPLAY')}
                >
                  <Select.Value placeholder={t('MENU_DISPLAY')} />
                </Select.Trigger>
                {/* z-[70]: el drawer de la tienda ya es z-[60]. */}
                <Select.Content className="z-[70]">
                  <Select.Item value="icon">{t('MENU_DISPLAY_ICON')}</Select.Item>
                  <Select.Item value="text">{t('MENU_DISPLAY_TEXT')}</Select.Item>
                </Select.Content>
              </Select>

              <div className="ml-auto flex shrink-0 items-center">
                <IconButton
                  type="button"
                  size="small"
                  variant="transparent"
                  aria-label={t('MOBILE_NAV_MOVE_UP')}
                  disabled={index === 0}
                  onClick={() =>
                    onChange({ ...value, mobileNav: move(value.mobileNav, index, index - 1) })
                  }
                >
                  <ArrowUpMini />
                </IconButton>
                <IconButton
                  type="button"
                  size="small"
                  variant="transparent"
                  aria-label={t('MOBILE_NAV_MOVE_DOWN')}
                  disabled={index === value.mobileNav.length - 1}
                  onClick={() =>
                    onChange({ ...value, mobileNav: move(value.mobileNav, index, index + 1) })
                  }
                >
                  <ArrowDownMini />
                </IconButton>
              </div>
            </div>
          );
        })}

        {MENU_ONLY.map((row) => (
          <div
            key={row.key}
            className="flex flex-col gap-y-2 rounded-md border border-ui-border-base px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <Text size="small" weight="plus" className="flex-1">
                {t(row.label)}
              </Text>
              <Switch
                className="shrink-0"
                aria-label={t(row.label)}
                checked={value.sections[row.key]}
                onCheckedChange={(checked) => setSection(row.key, checked)}
              />
            </div>
            {/* El diseño del menú de categorías vive en su propia fila: apagado
                el menú, no hay nada que diseñar. */}
            {row.key === 'categories' && value.sections.categories && (
              <Select
                value={value.categoriesMenuLayout}
                onValueChange={(next) =>
                  onChange({
                    ...value,
                    categoriesMenuLayout: next as ContentConfigForm['categoriesMenuLayout'],
                  })
                }
              >
                <Select.Trigger aria-label={t('CONTENT_CATEGORIES_LAYOUT')}>
                  <Select.Value placeholder={t('CONTENT_CATEGORIES_LAYOUT')} />
                </Select.Trigger>
                <Select.Content className="z-[70]">
                  <Select.Item value="hamburger">
                    {t('CONTENT_CATEGORIES_LAYOUT_HAMBURGER')}
                  </Select.Item>
                  <Select.Item value="button">
                    {t('CONTENT_CATEGORIES_LAYOUT_BUTTON')}
                  </Select.Item>
                </Select.Content>
              </Select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
