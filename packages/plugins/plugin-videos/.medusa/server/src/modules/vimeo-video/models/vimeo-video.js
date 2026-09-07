"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VimeoVideo = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.VimeoVideo = utils_1.model.define('vimeo_video', {
    id: utils_1.model.id().primaryKey(),
    vimeo_id: utils_1.model.text().unique(),
    vimeo_uri: utils_1.model.text(),
    title: utils_1.model.text(),
    description: utils_1.model.text().nullable(),
    thumbnail_url: utils_1.model.text().nullable(),
    // Poster elegido a mano desde el admin. Tiene prioridad sobre thumbnail_url
    // (el de Vimeo) y se muestra en el front mientras el video carga.
    poster_url: utils_1.model.text().nullable(),
    vimeo_url: utils_1.model.text().nullable(),
    duration: utils_1.model.number().nullable(),
    status: utils_1.model
        .enum([
        'uploading',
        'transcoding',
        'processing',
        'available',
        'error',
        'quota_exceeded',
        'total_cap_exceeded',
        'transcode_starting',
        'unavailable',
    ])
        .default('uploading'),
    is_active: utils_1.model.boolean().default(true),
    // Controla si el video aparece en el carrousel de la home (independiente de
    // is_active, que habilita el video en general, ej. en la ficha de producto).
    show_in_carousel: utils_1.model.boolean().default(true),
    sort_order: utils_1.model.number().default(0),
    // Segmentación por sales channel: array de ids. null/[] = visible en todos
    // los canales (global). En contexto demo el storefront pide solo los videos
    // cuyo array incluye el canal de la demo.
    sales_channel_ids: utils_1.model.json().nullable(),
    metadata: utils_1.model.json().nullable(),
    product_links: utils_1.model.hasMany(() => {
        return require('./product-video-link').ProductVideoLink;
    }, {
        mappedBy: 'vimeo_video',
    }),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmltZW8tdmlkZW8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy92aW1lby12aWRlby9tb2RlbHMvdmltZW8tdmlkZW8udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBR3JDLFFBQUEsVUFBVSxHQUFHLGFBQUssQ0FBQyxNQUFNLENBQUMsYUFBYSxFQUFFO0lBQ3BELEVBQUUsRUFBRSxhQUFLLENBQUMsRUFBRSxFQUFFLENBQUMsVUFBVSxFQUFFO0lBQzNCLFFBQVEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFO0lBQy9CLFNBQVMsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ3ZCLEtBQUssRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ25CLFdBQVcsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3BDLGFBQWEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3RDLDRFQUE0RTtJQUM1RSxrRUFBa0U7SUFDbEUsVUFBVSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbkMsU0FBUyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbEMsUUFBUSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbkMsTUFBTSxFQUFFLGFBQUs7U0FDVixJQUFJLENBQUM7UUFDSixXQUFXO1FBQ1gsYUFBYTtRQUNiLFlBQVk7UUFDWixXQUFXO1FBQ1gsT0FBTztRQUNQLGdCQUFnQjtRQUNoQixvQkFBb0I7UUFDcEIsb0JBQW9CO1FBQ3BCLGFBQWE7S0FDZCxDQUFDO1NBQ0QsT0FBTyxDQUFDLFdBQVcsQ0FBQztJQUN2QixTQUFTLEVBQUUsYUFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDeEMsNEVBQTRFO0lBQzVFLDZFQUE2RTtJQUM3RSxnQkFBZ0IsRUFBRSxhQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztJQUMvQyxVQUFVLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDckMsMkVBQTJFO0lBQzNFLDRFQUE0RTtJQUM1RSwwQ0FBMEM7SUFDMUMsaUJBQWlCLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMxQyxRQUFRLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNqQyxhQUFhLEVBQUUsYUFBSyxDQUFDLE9BQU8sQ0FDMUIsR0FBNEIsRUFBRTtRQUM1QixPQUFPLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0lBQzFELENBQUMsRUFDRDtRQUNFLFFBQVEsRUFBRSxhQUFhO0tBQ3hCLENBQ0Y7Q0FDRixDQUFDLENBQUMifQ==