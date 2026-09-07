import Medusa from '@medusajs/js-sdk';

/**
 * Storefront-side SDK for the loyalty plugin's BFF routes.
 *
 * These routes run server-side inside the template's Next.js app, so
 * `NEXT_PUBLIC_MEDUSA_BACKEND_URL` and `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` are
 * baked into the build. Creating the SDK here (instead of importing the
 * template's `@lib/config` sdk) keeps the plugin usable in any storefront
 * without a specific path-alias convention.
 *
 * Defaults `http://localhost:9000` for local dev; production builds MUST set
 * `NEXT_PUBLIC_MEDUSA_BACKEND_URL`, otherwise every request hits localhost
 * inside the container and returns nothing.
 */
export const sdk = new Medusa({
  baseUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000',
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
});
