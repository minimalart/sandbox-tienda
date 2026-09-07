# @minimalart/mercatto-plugin-fiscal-documentation

Versioned fiscal documentation for Mercatto stores (Medusa 2.18+). Ships the `fiscal_documentation` module — per-owner (`corporate`/`company`) history of ARCA "constancia de inscripción" snapshots with SHA-hashed diffs, PDF generation and retention policy — bundled with the `arca` client (WSAA login, padrón A5 lookup, response normalization).

The AR-specific autocomplete for the storefront Factura A checkout ships in the same bundle: `POST /store/arca/taxpayer-lookup` is registered from this plugin.

## Ships

- `fiscal_documentation` module with the `fiscal_document` table (owner-polymorphic, append-only history: `vigente`/`historica`).
- `arca` module: WSAA ticket issuer, `ws_sr_constancia_inscripcion` client, normalized taxpayer mapper, in-memory cache seam.
- Admin API under `/admin/fiscal-documents/*` (list, create, retrieve, download PDF, diff, config GET/POST).
- Store API under `/store/arca/taxpayer-lookup` for Factura A autocomplete on the checkout (public, publishable-key-scoped, IP rate-limited, hardened to always return JSON so the checkout never crashes).
- Multi-tenant scoping via the vendored `lib/multistore` shim (same shim shape as plugin-catalogador).

## Environment

- `ARCA_CERTIFICATE_BASE64` — X.509 certificate emitted by AFIP for the represented CUIT, base64 of the PEM (or raw PEM).
- `ARCA_CERTIFICATE_PATH` — legacy fallback: filesystem path to the certificate PEM. Only consulted when `_BASE64` is empty; only at instance level.
- `ARCA_CUIT_REPRESENTADA` — the 11-digit CUIT the certificate belongs to.
- `ARCA_ENVIRONMENT` — `homologacion` (test) or `production`. **Anything else falls to `homologacion`** — a productive default from an empty value would emit real receipts the first time a caller points `ARCA_WSAA_SERVICE` at `wsfe`.
- `ARCA_PRIVATE_KEY_BASE64` — private key of the certificate pair, base64 of the PEM (or raw PEM).
- `ARCA_PRIVATE_KEY_PATH` — legacy fallback: filesystem path to the private key PEM.
- `ARCA_WSAA_SERVICE` — WSAA service name to request a ticket for. Default: `ws_sr_constancia_inscripcion` (the only one this module knows how to consume).

## Install

```
pnpm add @minimalart/mercatto-plugin-fiscal-documentation
```

Register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-fiscal-documentation', options: {} },
]
```

## Migration notes

Two host-owned pieces are deliberately relaxed in this initial plugin migration:

1. **Per-store ARCA settings** (`app-settings` layer) are not available inside the plugin — the plugin reads ARCA config directly from `process.env`. Restoring per-store precedence requires either extracting `app-settings` to a shared package or exposing a read-only accessor through the host container.
2. **Per-store ARCA credentials** (`site_credential` reader) return `null` in the plugin — the reader depends on `lib/shared/encryption-key.ts` which lives in the host. All stores fall back to instance-level certificate + key until the reader is available in the plugin's bundle.

The host still owns the `descriptors/fiscal-documentation.ts` app-settings descriptor (the credentials + preferences UI in the admin) and the `admin/help/fiscal-documentation.ts` help drawer text. They stay in the host because the admin surface (extensions settings card, help drawer registry) reads them from the host tree.
