import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Navigate, useLocation } from 'react-router-dom';
const Page = () => { const { search } = useLocation(); return <Navigate to={`/settings/site-credentials${search}`} replace />; };
export const config = defineRouteConfig({ label: 'credentials', translationNs: 'marketingPrivacy', rank: 4 });
export default Page;
