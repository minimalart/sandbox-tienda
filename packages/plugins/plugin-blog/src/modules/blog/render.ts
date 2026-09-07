import { generateHTML } from '@tiptap/html';
import sanitizeHtml from 'sanitize-html';
import { getBlogEditorExtensions } from './tiptap-extensions';

/**
 * Converts a Tiptap JSON document to sanitized HTML for SSR on the storefront.
 * Runs server-side (Node) so article content lands in the initial HTML — good
 * for SEO. Uses the same extension set as the admin editor, then sanitizes the
 * output with an allowlist that matches the editor's feature scope (headings,
 * formatting, lists, links, images, tables and YouTube/Vimeo iframes).
 */
export function renderBlogContentHtml(content: unknown): string {
  if (!content || typeof content !== 'object') {
    return '';
  }
  let raw = '';
  try {
    raw = generateHTML(content as Record<string, unknown>, getBlogEditorExtensions());
  } catch {
    return '';
  }

  return sanitizeHtml(raw, {
    allowedTags: [
      'p', 'br', 'hr', 'blockquote', 'pre', 'code',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'u', 's', 'span', 'mark',
      'ul', 'ol', 'li',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'iframe', 'div',
      // Task list checkboxes: TaskItem serializes to <li><label><input
      // type="checkbox">…</label><div>…</div></li>. Without these tags the
      // sanitizer strips the checkbox, leaving checklists as plain text.
      'label', 'input',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      span: ['style'],
      mark: ['style', 'data-color'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
      li: ['data-type', 'data-checked'],
      ul: ['data-type'],
      input: ['type', 'checked', 'disabled'],
      div: ['data-youtube-video'],
      iframe: [
        'src', 'width', 'height', 'frameborder', 'allow',
        'allowfullscreen', 'title',
      ],
    },
    allowedStyles: {
      '*': {
        color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/, /^[a-z]+$/i],
        'background-color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/, /^[a-z]+$/i],
        'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
      },
    },
    allowedIframeHostnames: [
      'www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com',
      'player.vimeo.com',
    ],
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      // Harden external links.
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
      // Task-list checkboxes are display-only on the storefront; keep their
      // checked state but prevent interaction.
      input: sanitizeHtml.simpleTransform('input', { disabled: 'disabled' }),
    },
  });
}
