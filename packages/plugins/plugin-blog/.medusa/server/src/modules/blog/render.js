"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderBlogContentHtml = renderBlogContentHtml;
const html_1 = require("@tiptap/html");
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const tiptap_extensions_1 = require("./tiptap-extensions");
/**
 * Converts a Tiptap JSON document to sanitized HTML for SSR on the storefront.
 * Runs server-side (Node) so article content lands in the initial HTML — good
 * for SEO. Uses the same extension set as the admin editor, then sanitizes the
 * output with an allowlist that matches the editor's feature scope (headings,
 * formatting, lists, links, images, tables and YouTube/Vimeo iframes).
 */
function renderBlogContentHtml(content) {
    if (!content || typeof content !== 'object') {
        return '';
    }
    let raw = '';
    try {
        raw = (0, html_1.generateHTML)(content, (0, tiptap_extensions_1.getBlogEditorExtensions)());
    }
    catch {
        return '';
    }
    return (0, sanitize_html_1.default)(raw, {
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
            a: sanitize_html_1.default.simpleTransform('a', { rel: 'noopener noreferrer' }),
            // Task-list checkboxes are display-only on the storefront; keep their
            // checked state but prevent interaction.
            input: sanitize_html_1.default.simpleTransform('input', { disabled: 'disabled' }),
        },
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvYmxvZy9yZW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFXQSxzREE2REM7QUF4RUQsdUNBQTRDO0FBQzVDLGtFQUF5QztBQUN6QywyREFBOEQ7QUFFOUQ7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IscUJBQXFCLENBQUMsT0FBZ0I7SUFDcEQsSUFBSSxDQUFDLE9BQU8sSUFBSSxPQUFPLE9BQU8sS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUM1QyxPQUFPLEVBQUUsQ0FBQztJQUNaLENBQUM7SUFDRCxJQUFJLEdBQUcsR0FBRyxFQUFFLENBQUM7SUFDYixJQUFJLENBQUM7UUFDSCxHQUFHLEdBQUcsSUFBQSxtQkFBWSxFQUFDLE9BQWtDLEVBQUUsSUFBQSwyQ0FBdUIsR0FBRSxDQUFDLENBQUM7SUFDcEYsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztJQUVELE9BQU8sSUFBQSx1QkFBWSxFQUFDLEdBQUcsRUFBRTtRQUN2QixXQUFXLEVBQUU7WUFDWCxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLE1BQU07WUFDNUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO1lBQ2xDLFFBQVEsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsTUFBTTtZQUN4QyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7WUFDaEIsR0FBRyxFQUFFLEtBQUs7WUFDVixPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7WUFDM0MsUUFBUSxFQUFFLEtBQUs7WUFDZixpRUFBaUU7WUFDakUscUVBQXFFO1lBQ3JFLG1FQUFtRTtZQUNuRSxPQUFPLEVBQUUsT0FBTztTQUNqQjtRQUNELGlCQUFpQixFQUFFO1lBQ2pCLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDO1lBQzVCLEdBQUcsRUFBRSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUM7WUFDL0MsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDO1lBQ2YsSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQztZQUM3QixFQUFFLEVBQUUsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDO1lBQzFCLEVBQUUsRUFBRSxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUM7WUFDMUIsRUFBRSxFQUFFLENBQUMsV0FBVyxFQUFFLGNBQWMsQ0FBQztZQUNqQyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUM7WUFDakIsS0FBSyxFQUFFLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxVQUFVLENBQUM7WUFDdEMsR0FBRyxFQUFFLENBQUMsb0JBQW9CLENBQUM7WUFDM0IsTUFBTSxFQUFFO2dCQUNOLEtBQUssRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxPQUFPO2dCQUNoRCxpQkFBaUIsRUFBRSxPQUFPO2FBQzNCO1NBQ0Y7UUFDRCxhQUFhLEVBQUU7WUFDYixHQUFHLEVBQUU7Z0JBQ0gsS0FBSyxFQUFFLENBQUMsb0JBQW9CLEVBQUUsUUFBUSxFQUFFLFdBQVcsQ0FBQztnQkFDcEQsa0JBQWtCLEVBQUUsQ0FBQyxvQkFBb0IsRUFBRSxRQUFRLEVBQUUsV0FBVyxDQUFDO2dCQUNqRSxZQUFZLEVBQUUsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUM7YUFDN0Q7U0FDRjtRQUNELHNCQUFzQixFQUFFO1lBQ3RCLGlCQUFpQixFQUFFLGFBQWEsRUFBRSwwQkFBMEI7WUFDNUQsa0JBQWtCO1NBQ25CO1FBQ0QsY0FBYyxFQUFFLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDO1FBQ2xELGFBQWEsRUFBRTtZQUNiLHlCQUF5QjtZQUN6QixDQUFDLEVBQUUsdUJBQVksQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLEVBQUUsR0FBRyxFQUFFLHFCQUFxQixFQUFFLENBQUM7WUFDcEUsc0VBQXNFO1lBQ3RFLHlDQUF5QztZQUN6QyxLQUFLLEVBQUUsdUJBQVksQ0FBQyxlQUFlLENBQUMsT0FBTyxFQUFFLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxDQUFDO1NBQ3ZFO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyJ9