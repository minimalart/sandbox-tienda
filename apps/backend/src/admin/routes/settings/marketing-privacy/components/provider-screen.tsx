import { Container, Text } from '@medusajs/ui';
import { useActiveSite } from '../../../../hooks/use-active-site';
import { SiteScopeBar } from '../../../../components/common/site-scope-bar';
import { findNamespace } from '../../../../../modules/app-settings/descriptors';
import { ProviderCard } from './provider-cards';
import { usePrivacyTranslation } from '../i18n';
export default function ProviderScreen({ kind }: { kind: 'clarity' | 'merchant' }) {
  const { activeId, isPending } = useActiveSite();
  const { t } = usePrivacyTranslation();
  if (isPending) return <Container><Text>{t('loading')}</Text></Container>;
  if (!findNamespace(kind === 'clarity' ? 'extension:clarity' : 'extension:google-merchant')) return <Container><Text>{t('unavailable')}</Text></Container>;
  return <><SiteScopeBar screen="marketing-privacy" reloadOnChange={false} allowInstance /><ProviderCard key={activeId ?? 'global'} kind={kind} siteId={activeId} /></>;
}
