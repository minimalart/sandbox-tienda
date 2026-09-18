import { defineRouteConfig } from '@medusajs/admin-sdk';
import SettingsScreen from '../../settings/marketing-privacy/components/settings-screen';
const Page = () => <SettingsScreen section="privacy" />;
export const config = defineRouteConfig({ label: 'privacy', translationNs: 'marketingPrivacy', rank: 5 });
export default Page;
