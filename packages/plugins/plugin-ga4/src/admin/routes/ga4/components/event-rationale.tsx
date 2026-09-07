import { Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';

const GOOGLE_RECOMMENDED_EVENTS_URL = 'https://support.google.com/analytics/answer/9267735';

/**
 * Muestra el "por qué" de una asociación evento Medusa ↔ evento GA4 (rationale
 * curado en base a los eventos recomendados de Google) + un link a la doc
 * oficial. `whyKey` es la clave en WHY (eventI18nKey para genéricos, builtin_key
 * para built-ins, ga4_event para los managed). Si no hay texto, no renderiza.
 */
export const EventRationale = ({ whyKey }: { whyKey: string }) => {
  const { t } = useTranslation('ga4Events');
  const why = t(`WHY.${whyKey}`, { defaultValue: '' });

  if (!why) return null;

  return (
    <div className="flex flex-col gap-1 rounded-lg bg-ui-bg-subtle px-3 py-2">
      <Text size="small" weight="plus" className="text-ui-fg-subtle">
        {t('WHY_LABEL')}
      </Text>
      <Text size="small" className="text-ui-fg-subtle">
        {why}
      </Text>
      <a
        href={GOOGLE_RECOMMENDED_EVENTS_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="txt-compact-small text-ui-fg-interactive"
      >
        {t('WHY_SOURCE')} ↗
      </a>
    </div>
  );
};
