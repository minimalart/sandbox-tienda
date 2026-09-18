import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ChartBar } from '@medusajs/icons';
import { Navigate } from 'react-router-dom';
const Page = () => <Navigate to="/marketing-privacy/privacy" replace />;
export const config = defineRouteConfig({ label: 'Marketing & Privacy', icon: ChartBar, rank: 42 });
export const handle = { breadcrumb: () => 'Marketing & Privacy' };
export default Page;
