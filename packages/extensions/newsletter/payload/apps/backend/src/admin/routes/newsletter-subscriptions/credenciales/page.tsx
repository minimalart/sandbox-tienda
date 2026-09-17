import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Navigate } from 'react-router-dom';

const CredentialsPage = () => <Navigate to="/settings/site-credentials#newsletter" replace />;
export const handle = { breadcrumb: () => 'Credenciales' };
export default CredentialsPage;
