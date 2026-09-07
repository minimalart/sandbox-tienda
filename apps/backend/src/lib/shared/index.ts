// MIRROR de `packages/shared` — vendorizado en el backend a propósito.
//
// El deploy de DigitalOcean construye SOLO `apps/backend` con el buildpack de
// Node (npm), que no entiende el protocolo `workspace:*` de pnpm. Depender de
// `@repo/shared` como workspace rompía el build (EUNSUPPORTEDPROTOCOL). Para
// que `apps/backend` sea autocontenido copiamos acá el contrato compartido.
//
// Fuente de verdad para el storefront: `packages/shared`. Si cambia el contrato
// (gift cards, etc.), actualizar AMBOS lados.
export * from './env';
// Gift Card contract moved to @minimalart/mercatto-plugin-gift-cards; a minimal
// shim (`normalizeGiftCardConfig`, `assertGiftCardBuyerIsNotRecipient`) stays
// in `./gift-cards` because `apps/backend/src/scripts/backfill-gift-card-deliveries.ts`
// (invoked via `pnpm gift-cards:backfill`) still lives in the host and needs
// them without loading the plugin. The full contract stays authoritative at
// `packages/shared/gift-cards.ts` mirrored inside the plugin.
export * from './gift-cards';
export * from './types';
