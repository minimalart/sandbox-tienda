import type { Extensions } from '@tiptap/core';
/**
 * Shared Tiptap extension set — the single source of truth for both the admin
 * editor (`@tiptap/react` useEditor) and the storefront's server-side
 * JSON→HTML conversion (`@tiptap/html` generateHTML). Keeping one list ensures
 * what authors write is exactly what renders.
 *
 * Covers the MVP editor scope: headings/paragraphs, bold/italic/underline/
 * strike, color + highlight, bullet/ordered/task lists, quote, separator
 * (horizontalRule from StarterKit), links, images, YouTube/Vimeo embeds and
 * basic tables.
 */
export declare function getBlogEditorExtensions(): Extensions;
