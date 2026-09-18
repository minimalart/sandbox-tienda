import { Button, Container, Heading, Text } from '@medusajs/ui';
import { Link } from 'react-router-dom';
import { usePrivacyTranslation } from '../../settings/marketing-privacy/i18n';

/** Keep the legacy settings entry discoverable without a second consent switch. */
export const StorefrontSettingsCard = () => {
  const { t } = usePrivacyTranslation();
  return (
    <Container className="p-0">
      <div className="px-6 py-4">
        <Heading level="h2">{t('privacy')}</Heading>
        <Text size="small" className="text-ui-fg-subtle">{t('privacyMoved')}</Text>
      </div>
      <div className="px-6 pb-6">
        <Button variant="secondary" asChild><Link to="/settings/marketing-privacy/privacy">{t('manage')}</Link></Button>
      </div>
    </Container>
  );
};
