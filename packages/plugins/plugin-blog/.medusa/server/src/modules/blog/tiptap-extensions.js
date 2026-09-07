"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlogEditorExtensions = getBlogEditorExtensions;
const starter_kit_1 = __importDefault(require("@tiptap/starter-kit"));
const extension_underline_1 = __importDefault(require("@tiptap/extension-underline"));
const extension_link_1 = __importDefault(require("@tiptap/extension-link"));
const extension_image_1 = __importDefault(require("@tiptap/extension-image"));
const extension_youtube_1 = __importDefault(require("@tiptap/extension-youtube"));
const extension_text_style_1 = __importDefault(require("@tiptap/extension-text-style"));
const extension_color_1 = require("@tiptap/extension-color");
const extension_highlight_1 = __importDefault(require("@tiptap/extension-highlight"));
const extension_task_list_1 = __importDefault(require("@tiptap/extension-task-list"));
const extension_task_item_1 = __importDefault(require("@tiptap/extension-task-item"));
const extension_table_1 = __importDefault(require("@tiptap/extension-table"));
const extension_table_row_1 = __importDefault(require("@tiptap/extension-table-row"));
const extension_table_header_1 = __importDefault(require("@tiptap/extension-table-header"));
const extension_table_cell_1 = __importDefault(require("@tiptap/extension-table-cell"));
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
function getBlogEditorExtensions() {
    return [
        starter_kit_1.default.configure({
            heading: { levels: [1, 2, 3, 4, 5, 6] },
        }),
        extension_underline_1.default,
        extension_text_style_1.default,
        extension_color_1.Color,
        extension_highlight_1.default.configure({ multicolor: true }),
        extension_link_1.default.configure({ openOnClick: false, autolink: true }),
        extension_image_1.default,
        extension_youtube_1.default.configure({ controls: true, nocookie: true }),
        extension_task_list_1.default,
        extension_task_item_1.default.configure({ nested: true }),
        extension_table_1.default.configure({ resizable: false }),
        extension_table_row_1.default,
        extension_table_header_1.default,
        extension_table_cell_1.default,
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGlwdGFwLWV4dGVuc2lvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9ibG9nL3RpcHRhcC1leHRlbnNpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBMkJBLDBEQW1CQztBQTlDRCxzRUFBNkM7QUFDN0Msc0ZBQW9EO0FBQ3BELDRFQUEwQztBQUMxQyw4RUFBNEM7QUFDNUMsa0ZBQWdEO0FBQ2hELHdGQUFxRDtBQUNyRCw2REFBZ0Q7QUFDaEQsc0ZBQW9EO0FBQ3BELHNGQUFtRDtBQUNuRCxzRkFBbUQ7QUFDbkQsOEVBQTRDO0FBQzVDLHNGQUFtRDtBQUNuRCw0RkFBeUQ7QUFDekQsd0ZBQXFEO0FBR3JEOzs7Ozs7Ozs7O0dBVUc7QUFDSCxTQUFnQix1QkFBdUI7SUFDckMsT0FBTztRQUNMLHFCQUFVLENBQUMsU0FBUyxDQUFDO1lBQ25CLE9BQU8sRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7U0FDeEMsQ0FBQztRQUNGLDZCQUFTO1FBQ1QsOEJBQVM7UUFDVCx1QkFBSztRQUNMLDZCQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxDQUFDO1FBQ3pDLHdCQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFDdEQseUJBQUs7UUFDTCwyQkFBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDO1FBQ3JELDZCQUFRO1FBQ1IsNkJBQVEsQ0FBQyxTQUFTLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFDcEMseUJBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLENBQUM7UUFDckMsNkJBQVE7UUFDUixnQ0FBVztRQUNYLDhCQUFTO0tBQ1YsQ0FBQztBQUNKLENBQUMifQ==