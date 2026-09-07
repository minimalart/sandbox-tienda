# @minimalart/mercatto-plugin-contact

Mercatto plugin that adds a contact form module for Medusa 2.18. Extracted from `packages/extensions/contact` in the Mercatto boilerplate.

## Installation

```bash
pnpm add @minimalart/mercatto-plugin-contact
```

Register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: "@minimalart/mercatto-plugin-contact" }
]
```

Host must declare Vite dedupe for shared React libs:

```ts
admin: {
  vite: () => ({
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-query", "react-i18next", "i18next", "react-router-dom"]
    }
  })
}
```

## Requirements

- Medusa `2.18.0`
- Node `>=22.19.0`
- Peer extension `email-templates` (for notification templates)

## What it provides

- Module `contact` with `contact_submission` model
- Admin routes at `/admin/contact-submissions`
- Storefront route at `/store/contact-submissions`
- Admin UI page for reviewing submissions

## Events emitted

- `contact.submission.created` — payload `{ submissionId, siteId? }`

## Environment variables

None. Notification behaviour is inherited from the host `email` module.

## Migration from `packages/extensions/contact`

The plugin ships the same migrations as the extension. In stores where the extension was previously installed and migrations already applied, MikroORM skips them by class name. See `BLUEPRINT-estructura-plugins-y-extensiones.md` section 5 for the ownership rules.
