# @minimalart/mercatto-plugin-comments

Mercatto plugin that adds product and blog post comments/reviews to a Medusa backend.

## Features

- Comments and ratings on products and blog posts
- Three review modes: `comment`, `rating`, or `both`
- Moderation: `auto` (publish immediately) or `manual` (admin approves)
- Per-site (multi-tenant) configuration via `comment_settings`
- Admin UI: listing, moderation actions (approve / hide / delete), configuration tab
- Store endpoints for creating comments, replies, and eligibility checks
- Multi-tenant scoping on `comment.site_id` and `comment_settings.site_id`

## Install

```jsonc
// medusa-config.ts
{
  plugins: [
    {
      resolve: "@minimalart/mercatto-plugin-comments",
    },
  ],
}
```

The plugin ships its own `comment_settings` storage — no host `app-settings` bridge required.

Storefront server actions live in the host at:

- `apps/storefront/src/lib/data/comments.ts`
- `apps/storefront/src/lib/data/comments-actions.ts`

They call the plugin's `/admin/comments/*` and `/store/comments/*` endpoints.
