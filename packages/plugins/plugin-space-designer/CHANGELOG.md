# Changelog

## 1.1.0

- `config.checkout_mode` chooses how a shopper closes: `cart` (default, unchanged) or `quote`. In quote mode the storefront hides prices, stops gating on stock and collects a contact request instead of adding line items.
- New `space_quote` table, `POST /store/space-designer/quotes` and `GET/POST/DELETE /admin/space-designer/quotes[/:id]`, plus a Consultas screen in the backoffice.
- Backoffice wording now calls the saved record an "espacio", row actions moved to the shared dots menu, and clicking a row opens the editor again instead of throwing (`useDataTable` hands over the TanStack row, not the record).

## 1.0.0

Initial local release: versioned generic configurators, preassembled templates, included non-furniture products, scoped catalog validation, native batch cart integration, customer design snapshots and backoffice editing.
