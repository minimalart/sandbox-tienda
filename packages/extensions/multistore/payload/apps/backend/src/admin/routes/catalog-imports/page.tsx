import { Navigate } from 'react-router-dom';

/** Compatibilidad con enlaces publicados antes de integrar el catálogo en Tiendas. */
export default function CatalogImportsRedirect() {
  return <Navigate to="/sites" replace />;
}
