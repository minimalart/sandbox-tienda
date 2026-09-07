"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LandingPage = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * LandingPage — a visually-built marketing page authored with the Puck editor.
 *
 * - `puck_data`: the editor's native JSON ({ content, root }). Source of truth
 *   for rendering — never raw HTML, so the storefront renderer stays controlled
 *   by our own component mapping.
 * - `seo`: { title, description, image, noindex }.
 * - `status`: 'draft' | 'published' | 'archived'.
 *
 * Mirrors the Banner module's JSON-field approach (content/media/cta/rules).
 */
exports.LandingPage = utils_1.model
    .define('landing_page', {
    id: utils_1.model.id({ prefix: 'lpg' }).primaryKey(),
    title: utils_1.model.text(),
    slug: utils_1.model.text(),
    status: utils_1.model.text().default('draft'),
    description: utils_1.model.text().nullable(),
    seo: utils_1.model.json().nullable(),
    puck_data: utils_1.model.json().nullable(),
    template: utils_1.model.text().nullable(),
    locale: utils_1.model.text().nullable(),
    sales_channel_id: utils_1.model.text().nullable(),
    metadata: utils_1.model.json().nullable(),
    published_at: utils_1.model.dateTime().nullable(),
    created_by: utils_1.model.text().nullable(),
    updated_by: utils_1.model.text().nullable(),
})
    .indexes([
    { on: ['slug'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['status'] },
    { on: ['locale'] },
    { on: ['published_at'] },
    { on: ['status', 'slug'] },
]);
exports.default = exports.LandingPage;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFuZGluZy1wYWdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvbGFuZGluZy1wYWdlL21vZGVscy9sYW5kaW5nLXBhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRWxEOzs7Ozs7Ozs7O0dBVUc7QUFDVSxRQUFBLFdBQVcsR0FBRyxhQUFLO0tBQzdCLE1BQU0sQ0FBQyxjQUFjLEVBQUU7SUFDdEIsRUFBRSxFQUFFLGFBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUU7SUFDNUMsS0FBSyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDbkIsSUFBSSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDbEIsTUFBTSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO0lBQ3JDLFdBQVcsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3BDLEdBQUcsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzVCLFNBQVMsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2xDLFFBQVEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2pDLE1BQU0sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQy9CLGdCQUFnQixFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDekMsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDakMsWUFBWSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDekMsVUFBVSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbkMsVUFBVSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7Q0FDcEMsQ0FBQztLQUNELE9BQU8sQ0FBQztJQUNQLEVBQUUsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsb0JBQW9CLEVBQUU7SUFDM0QsRUFBRSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRTtJQUNsQixFQUFFLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFO0lBQ2xCLEVBQUUsRUFBRSxFQUFFLENBQUMsY0FBYyxDQUFDLEVBQUU7SUFDeEIsRUFBRSxFQUFFLEVBQUUsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLEVBQUU7Q0FDM0IsQ0FBQyxDQUFDO0FBRUwsa0JBQWUsbUJBQVcsQ0FBQyJ9