import { defineRouteConfig } from '@medusajs/admin-sdk';
import { DocumentText } from '@medusajs/icons';
import { Navigate } from 'react-router-dom';

/**
 * Parent "Blog" route. Registering a route at /blog makes it the parent menu
 * item; child routes (/blog/articles, /blog/categories, /blog/settings) nest
 * underneath it (the dashboard sidebar nests by path hierarchy). The page
 * itself just forwards to the articles list.
 */
const BlogIndex = () => <Navigate to="/blog/articles" replace />;

const BlogIcon = () => <DocumentText style={{ color: '#3B82F6' }} />;

export const config = defineRouteConfig({
  label: 'Blog',
  icon: BlogIcon,
  rank: 45,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Blog',
};

export default BlogIndex;
