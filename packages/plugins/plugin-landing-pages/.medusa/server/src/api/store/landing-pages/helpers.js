"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPublicLandingPage = toPublicLandingPage;
/** Public projection of a landing page (no internal/audit fields). */
function toPublicLandingPage(page) {
    return {
        id: page.id,
        title: page.title,
        slug: page.slug,
        description: page.description ?? null,
        seo: page.seo ?? null,
        puck_data: page.puck_data ?? { content: [], root: { props: {} } },
        template: page.template ?? null,
        locale: page.locale ?? null,
        metadata: page.metadata ?? null,
        published_at: page.published_at ?? null,
        updated_at: page.updated_at ?? null,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvc3RvcmUvbGFuZGluZy1wYWdlcy9oZWxwZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0Esa0RBY0M7QUFmRCxzRUFBc0U7QUFDdEUsU0FBZ0IsbUJBQW1CLENBQUMsSUFBeUI7SUFDM0QsT0FBTztRQUNMLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtRQUNYLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSztRQUNqQixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7UUFDZixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJO1FBQ3JDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxJQUFJLElBQUk7UUFDckIsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLElBQUksRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRTtRQUNqRSxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJO1FBQy9CLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxJQUFJLElBQUk7UUFDM0IsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSTtRQUMvQixZQUFZLEVBQUUsSUFBSSxDQUFDLFlBQVksSUFBSSxJQUFJO1FBQ3ZDLFVBQVUsRUFBRSxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUk7S0FDcEMsQ0FBQztBQUNKLENBQUMifQ==