import { Badge, Button, Drawer, Heading, Text, Tooltip } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { Ga4ManagedSource } from '../../../hooks/api/ga4-mappings';
import { registerGa4EventsTranslations } from '../../../translations/ga4-events';
import { EventRationale } from './event-rationale';

interface ManagedInfoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  ga4Event: string;
  description: string;
  source?: Ga4ManagedSource;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <Text size="small" weight="plus" className="text-ui-fg-subtle">
      {label}
    </Text>
    {children}
  </div>
);

/**
 * Panel de SOLO LECTURA para un evento que no se puede gestionar desde acá
 * (ej. begin_checkout, del storefront). Muestra claramente el evento GA4, el
 * evento de Medusa (ninguno para eventos del navegador), la descripción, la
 * fuente y el motivo por el que no es editable.
 */
export const ManagedInfoDrawer = ({
  open,
  onOpenChange,
  title,
  ga4Event,
  description,
  source,
}: ManagedInfoDrawerProps) => {
  const { t, i18n } = useTranslation('ga4Events');
  registerGa4EventsTranslations(i18n);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Heading>{title || t('DETAIL_TITLE')}</Heading>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            <Field label={t('COLUMN_GA4_EVENT')}>
              <code className="txt-compact-small text-ui-fg-base">{ga4Event}</code>
            </Field>

            <Field label={t('COLUMN_MEDUSA_EVENT')}>
              <Text size="small" className="text-ui-fg-muted">
                {t('MANAGED_MEDUSA_NONE')}
              </Text>
            </Field>

            {description && (
              <Field label={t('FIELD_DESCRIPTION_LABEL')}>
                <Text size="small" className="text-ui-fg-subtle">
                  {description}
                </Text>
              </Field>
            )}

            {source && (
              <Field label={t('DETAIL_SOURCE_LABEL')}>
                <Badge size="2xsmall" color="grey">
                  {t(`SOURCE.${source}`)}
                </Badge>
              </Field>
            )}

            <Field label={t('DETAIL_WHY_LABEL')}>
              <Text size="small" className="text-ui-fg-subtle">
                {source ? t(`MANAGED_WHY.${source}`) : t('MANAGED_REASON', { source: '' })}
              </Text>
            </Field>

            <EventRationale whyKey={ga4Event} />
          </div>
        </Drawer.Body>
        <Drawer.Footer className="flex items-center justify-between">
          {/* Eventos del storefront: no se gestionan desde el backend, por lo
              tanto tampoco se pueden eliminar desde acá. */}
          <Tooltip content={t('DELETE_DISABLED_MANAGED')}>
            <span tabIndex={0}>
              <Button variant="danger" disabled>
                {t('ACTION_DELETE')}
              </Button>
            </span>
          </Tooltip>
          <Drawer.Close asChild>
            <Button variant="secondary">{t('CANCEL')}</Button>
          </Drawer.Close>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
