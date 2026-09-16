import { DrawerTabs as SharedDrawerTabs } from '@minimalart/mercatto-plugin-runtime/admin';
import { useTranslation } from 'react-i18next';
export { DrawerTabPanel } from '@minimalart/mercatto-plugin-runtime/admin';

export function DrawerTabs<T extends string>(props: {
  tab: T;
  setTab: (tab: T) => void;
  tabs: readonly { id: T; label: string }[];
}) {
  const { t } = useTranslation('drawerTabs');
  return <SharedDrawerTabs {...props} previousLabel={t('previous')} nextLabel={t('next')} />;
}
