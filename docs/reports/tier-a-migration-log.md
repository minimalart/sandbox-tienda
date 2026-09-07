# Tier A migration log

Registro empírico de tiempos por plugin durante la migración de `packages/extensions/*` → `packages/plugins/*` publicados en GitHub Packages.

**Continuación del `tier-s-migration-log.md`.** Los 4 plugins de Tier S (brands, blog, landing-pages, banners) cerraron con los aprendizajes v1-v4 documentados en ese archivo. Este log arranca con Fase 2 (Tier A) aplicando todos esos aprendizajes desde el arranque.

## Convenciones (idénticas al Tier S log)

- **Timestamp**: hora local del sistema (`UTC-3`) capturada con `date`.
- **Compute time**: tiempo desde inicio del scaffold hasta que el deploy queda verde.
- **Dead time**: entre respuesta del asistente y siguiente asignación del user — tiempo perdido de calendario.
- **Iteración**: bucle "cambio → build → publish → deploy → verificar". Falla = iteración adicional.
- **Deploy verificado**: user confirma que funciona en prod.

## Aprendizajes acumulados de Tier S

- **v1**: 4 archivos-registro del host (`extension-middlewares`, `i18n/index`, `hooks/api/index`, `lib/extension-versions`) actualizados en el mismo commit.
- **v2**: Grep bare-relative para detectar cross-module consumers. Si consumers importan helpers reales → preservar shim dormant.
- **v3**: Build isolated con `--ignore-workspace` para primer build (evita chicken-and-egg de `apps/backend/package.json` bumpeado antes del publish).
- **v4**: Grep de dynamic imports (`import('.../workflows/xxx.js')`) — no matchea con grep normal. Si existen, preservar workflow como shim en host.
- **Regla local re-verify**: correr `pnpm exec tsc --noEmit` backend + storefront **Y** `pnpm exec medusa build` en la working tree antes de commit. Con fresh `pnpm install` para que no haya cache tibio.

## Plan Fase 2 (Tier A desbloqueado)

| # | Plugin | Estimado | Deps bloqueantes |
|---|---|---|---|
| 1 | `checkout-links` | ~40 min | ninguna |
| 2 | `payment-benefits` | ~1h | ninguna (MP token env) |
| 3 | `store-config` | ~2h | ninguna (foundational, desbloquea 4) |
| 4 | `ai-assistant` | ~3h+ (192 files, likely Tier B) | probable dep externa |

Después de `store-config`: desbloquea `catalogador`, `shop-by-looks`, `store-locations`, `seo-geo`.

## Session 2 timing budget

**Session 2 start**: 2026-09-01 11:55:21

Continuamos midiendo compute vs dead time vs bloqueos para comparar con session 1 (ratio 56%/43%/3%).

---

## Plugin 1: checkout-links

- **Extension origen**: `packages/extensions/checkout-links` v1.1.0 (19 files TS)
- **Deps**: ninguna
- **Env vars**: `NEXT_PUBLIC_BASE_URL`
- **PR**: #896

### Timeline

| Evento | Timestamp | Δ |
|---|---|---|
| Session 2 start / scaffold delegate | 11:55:21 | — |
| Scaffold end | 12:07:52 | 12m 31s |
| Build fail (JSDoc `*/` bug) | 12:15:15 | ~7m |
| Fix JSDoc + retry OK | 12:19:31 | 4m |
| Publish + regen locks + tsc + medusa build | 12:19 → 12:23 | 4m |
| Commit + push + PR #896 | 12:24:19 | 1m |
| Rebase preventivo (main #894/#895) | 12:35:15 | 11m |
| Rebase 2 (post banners #888 merged) + install fix | 13:39:15 | ~35m dead + 5m compute |
| **Total** | **~1h 44m** (incluyendo 2 rebases post-merge) | — |

### Aprendizajes nuevos

- **v5**: cross-module STATIC imports de workflows del plugin migrado (whatsapp-tools.ts) no detectados por grep v4 (solo dynamic). Fix con subpath export del plugin.
- **v6 (drift)**: extension source stale vs host. `settings/page.tsx` estaba en host pero no en extension payload — scaffold no lo copió. Detectado post-rebase.
- **v7 (post-plugin-add)**: después de agregar plugin nuevo a apps/backend/package.json y ANTES de medusa build, correr `pnpm install` para que pnpm linkee el workspace package. tsc pasa sin, medusa build no.

### Cierre

- **Pendiente merge de #896**

---

## Plugin 2: payment-benefits

- **Extension origen**: `packages/extensions/payment-benefits` v1.3.0 (28 files TS)
- **Deps**: ninguna
- **Env vars**: `MERCADOPAGO_ACCESS_TOKEN`
- **Superficie**: módulo `payment-benefits`, admin+store API, storefront lib data

### Análisis pre-scaffold (aprendizajes v1-v7)

**v2 bare-relative** (3 refs):
- `modules/app-settings/descriptors/index.ts:20` — descriptor
- `admin/help/index.ts:20` — help doc
- `admin/hooks/api/index.ts:31` — barrel export

**v4 dynamic imports**: 0 ✅
**v5 static workflow imports**: 0 ✅

**Workspace refs stale a limpiar**:
- `packages/extensions/mercadopago/package.json` declara `@repo/extension-payment-benefits: workspace:*` — remover en el scaffold

**Extension notable**: manifest incluye `api/store/payment-methods/route.ts` — file cross-cutting que sirve `/store/payment-methods` (probablemente lista los benefits disponibles). Puede requerir análisis especial.

### Scaffold

- **Inicio**: 2026-09-01 13:54:56
- _en progreso_

### Análisis pre-scaffold (aprendizajes v1-v4)

**v2 bare-relative** (3 refs):
- `apps/backend/src/modules/app-settings/descriptors/index.ts:7` — `import checkoutLinks from './checkout-links'`
- `apps/backend/src/admin/hooks/api/index.ts:9` — `export * from './checkout-links'`
- `apps/backend/src/admin/help/index.ts:7` — `import checkoutLinks from './checkout-links'`

**v4 dynamic imports**: 0 ✅
**Workspace refs**: solo su propio package.json ✅

**Decisión de shims**:
- `admin/hooks/api/index.ts` → v1 pattern: comment "moved to plugin" (barrel del plugin)
- `descriptors/checkout-links.ts` + `help/checkout-links.ts` → **preservar en host** (son declaraciones de config/UI del host, no lógica del plugin — no queremos moverlas y romper app-settings registry ni help registry)

### Scaffold

- **Inicio**: 2026-09-01 11:55:21
- **Fin**: 2026-09-01 12:07:52 (13 min)
- **PR**: #896 → hotfix #899 (row-click bug, bump 1.0.1)

---

## Plugin 3: payment-benefits

- **Extension origen**: `packages/extensions/payment-benefits` v1.3.0 (28 files TS)
- **Env vars**: `MERCADOPAGO_ACCESS_TOKEN`
- **PR**: #900
- **Scaffold**: 13:54:56 → 14:07:56 (13 min)
- **Compute total con hotfix intercalado**: ~1h 13min

### Aprendizajes nuevos

- **v8**: `scripts/plugin-consistency/check.mjs --fix` auto-actualiza 5 de los 7 lugares del bump (backend/package.json, ambos catalog.json, extension-versions.ts comments). Reduce hotfix cycle a ~15 min.

---

## Plugin 4: catalogador

- **Extension origen**: `packages/extensions/catalogador` v1.3.0 (58 files TS)
- **Env vars**: 9
- **Deps**: store-config (shim `foreign-modules`), media-library ✅, brands ✅
- **PR**: pendiente

### Análisis pre-scaffold (v1-v8)

**v2 bare-relative**: 3 refs (todos son archivos-registro, sin cross-consumer real):
- `admin/hooks/api/index.ts:8` — barrel export
- `admin/help/index.ts:6` — help import (preservar)
- `modules/app-settings/descriptors/index.ts:6` — descriptor import (preservar)

**v4 dynamic imports**: 0 ✅

**v5 static workflow imports**: 1 pero es INTRA-plugin:
- `apps/backend/src/jobs/catalogador-process.ts:15` importa `../workflows/catalogador/apply-execution`
- Ambos files (job + workflow) están managed por la extension y mueven juntos al plugin
- **Descubrimiento no cazado por audit**: hay un directorio anidado `workflows/catalogador/` con `apply-execution.ts`, no un file suelto

**Workspace refs stale**: 0 ✅

**Storefront reach**: 0 files

**Drift v6**: por confirmar durante scaffold

### Scaffold

- **Inicio**: 2026-09-01 15:21:08
- _en progreso_
