import { Navigate } from 'react-router-dom';

/** Compatibilidad con enlaces publicados antes de integrar el catálogo en Tiendas. */
const CatalogImportsRedirect = () => <Navigate to="/sites" replace />;

export default CatalogImportsRedirect;
