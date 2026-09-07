import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Navigate } from 'react-router-dom';

const CredentialsPage = () => <Navigate to="/settings/site-credentials#sendgrid" replace />;
export const config = defineRouteConfig({ label: 'Credenciales', rank: 99 });
export const handle = { breadcrumb: () => 'Credenciales' };
export default CredentialsPage;
