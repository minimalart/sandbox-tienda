import { Badge, Drawer, Label, StatusBadge, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { KapsoBindingsMap, KapsoTemplate } from '../../../hooks/api/kapso';
import { WHATSAPP_EVENT_BY_KEY } from '../../../lib/whatsapp-events-catalog';
import { registerWhatsappTranslations } from '../../../translations/whatsapp';
import { WhatsAppTemplatePreview } from './whatsapp-template-preview';

/** Componente BODY del template (para leer texto y ejemplos). */
function bodyComponent(components?: Array<Record<string, unknown>>) {
  return components?.find(
    (c) => String((c as { type?: string }).type ?? '').toUpperCase() === 'BODY',
  );
}

function bodyText(components?: Array<Record<string, unknown>>): string {
  return (bodyComponent(components)?.text as string) ?? '';
}

/** Ejemplos de Meta: components[BODY].example.body_text[0] = [ej1, ej2, …]. */
function bodyExamples(components?: Array<Record<string, unknown>>): string[] {
  const example = bodyComponent(components)?.example as
    | { body_text?: string[][] }
    | undefined;
  return example?.body_text?.[0] ?? [];
}

function statusColor(status?: string): 'green' | 'orange' | 'red' | 'grey' {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED':
      return 'green';
    case 'PENDING':
    case 'IN_APPEAL':
    case 'PENDING_DELETION':
      return 'orange';
    case 'REJECTED':
    case 'DISABLED':
    case 'PAUSED':
      return 'red';
    default:
      return 'grey';
  }
}

/** Eventos a los que está asignado el template (reverse-lookup sobre bindings). */
function eventsForTemplate(name: string, bindings: KapsoBindingsMap) {
  return Object.entries(bindings)
    .filter(([, b]) => b.template_name === name)
    .map(([key, b]) => ({
      key,
      labelKey: WHATSAPP_EVENT_BY_KEY[key]?.labelKey,
      published: b.status === 'published',
    }));
}

/**
 * Drawer de solo lectura para ver una plantilla: preview del cuerpo, sus datos
 * (idioma, categoría, estado) y los eventos a los que está asignada. Para editar
 * se usa el modal de edición.
 */
export const TemplateViewDrawer = ({
  template,
  bindings,
  open,
  onOpenChange,
}: {
  template: KapsoTemplate;
  bindings: KapsoBindingsMap;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { t, i18n } = useTranslation('whatsapp');
  registerWhatsappTranslations(i18n);

  const body = bodyText(template.components);
  const examples = bodyExamples(template.components);
  const assigned = eventsForTemplate(template.name, bindings);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{t('VIEW_TITLE', { name: template.name })}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-5 overflow-y-auto">
          <WhatsAppTemplatePreview value={body} examples={examples} />

          <div className="flex flex-col gap-2">
            <Label size="small" className="uppercase text-ui-fg-muted">
              {t('VIEW_META_HEADING')}
            </Label>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <Text size="small" className="text-ui-fg-subtle">
                {t('COL_LANGUAGE')}
              </Text>
              <Text size="small">{template.language}</Text>

              <Text size="small" className="text-ui-fg-subtle">
                {t('COL_CATEGORY')}
              </Text>
              <Text size="small">{template.category}</Text>

              <Text size="small" className="text-ui-fg-subtle">
                {t('COL_STATUS')}
              </Text>
              <div>
                <StatusBadge color={statusColor(template.status)}>
                  {template.status ?? '—'}
                </StatusBadge>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label size="small" className="uppercase text-ui-fg-muted">
              {t('VIEW_ASSIGNED_EVENTS')}
            </Label>
            {assigned.length ? (
              <div className="flex flex-wrap gap-1">
                {assigned.map((a) => (
                  <Badge
                    key={a.key}
                    size="2xsmall"
                    color={a.published ? 'green' : 'grey'}
                  >
                    {a.labelKey ? t(a.labelKey) : a.key}
                  </Badge>
                ))}
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-muted">
                {t('UNASSIGNED')}
              </Text>
            )}
          </div>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
};
