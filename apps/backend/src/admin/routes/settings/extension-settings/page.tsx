import { Navigate, useLocation } from 'react-router-dom';

/** Mantiene los enlaces existentes sin duplicar la entrada en Ajustes. */
const ExtensionSettingsPage = () => {
  const location = useLocation();
  return <Navigate to={{ pathname: '/settings/site-credentials', search: location.search, hash: 'globales' }} replace />;
};

export default ExtensionSettingsPage;
