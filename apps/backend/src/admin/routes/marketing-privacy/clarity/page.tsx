import { defineRouteConfig } from '@medusajs/admin-sdk';
import ProviderScreen from '../../settings/marketing-privacy/components/provider-screen';
const Page = () => <ProviderScreen kind="clarity" />;
export const config = defineRouteConfig({ label: 'Microsoft Clarity', rank: 3 });
export default Page;
