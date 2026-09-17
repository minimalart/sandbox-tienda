import { defineRouteConfig } from '@medusajs/admin-sdk';
import ProviderScreen from '../../settings/marketing-privacy/components/provider-screen';
const Page = () => <ProviderScreen kind="merchant" />;
export const config = defineRouteConfig({ label: 'Google Merchant Center', rank: 1 });
export default Page;
