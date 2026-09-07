/**
 * Converts a Tiptap JSON document to sanitized HTML for SSR on the storefront.
 * Runs server-side (Node) so article content lands in the initial HTML — good
 * for SEO. Uses the same extension set as the admin editor, then sanitizes the
 * output with an allowlist that matches the editor's feature scope (headings,
 * formatting, lists, links, images, tables and YouTube/Vimeo iframes).
 */
export declare function renderBlogContentHtml(content: unknown): string;
