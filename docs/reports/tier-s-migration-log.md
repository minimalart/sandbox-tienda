# Tier S migration log

Registro empírico de tiempos por plugin durante la migración de `packages/extensions/*` → `packages/plugins/*` publicados en GitHub Packages.

## Convenciones

- **Timestamp**: hora local del sistema (mismo huso: `UTC-3` Argentina) capturada con `date`.
- **Compute time**: tiempo total desde inicio del scaffold hasta que el deploy queda verde.
- **Dead time**: tiempo entre que el asistente termina de responder y el usuario asigna la siguiente acción — cuenta como tiempo perdido de calendario, no como cómputo.
- **Iteración**: bucle "aplicar cambio → build → publish → deploy → verificar". Si falla, cuenta como iteración adicional.
- **Deploy verificado**: usuario confirma que el plugin funciona en producción (DO) sin errores.

## Plan Fase 1 (Tier S limpio, sin bloqueadores)

| # | Plugin | Estimado | Deps |
|---|---|---|---|
| 1 | `brands` | ~2.5h | ninguna |
| 2 | `blog` | ~3h | media-library ✅ |
| 3 | `landing-pages` | ~3.5h | media-library ✅ |
| 4 | `banners` | ~3.5h | media-library ✅, landing-pages, blog |

**Total estimado Fase 1**: ~12.5h de cómputo neto.

---

## Plugin 1: brands

- **Extension origen**: `packages/extensions/brands` v1.6.0 (45 files TS)
- **Deps**: ninguna, 0 env vars
- **Superficie**: módulo `brand`, admin routes `/brands`, admin+store API, link a `product`

### Scaffold

- **Inicio scaffold**: 2026-08-31 10:33:43
- **Fin scaffold**: 2026-08-31 10:46:45
- **Duración**: 13 min ⚡ (vs 60-90 min estimado — delegación a sub-agents Explore + general-purpose)

**Deuda técnica detectada durante scaffold** (a decidir antes de iteración 1):
- `lib/multistore/*` helpers (siteFromRequest, siteFilter, assertRowInSite, etc.) vivían en el host. El agente scaffold los vendoreó como stub **fail-open single-site** — esto es una regresión funcional: en desdeelsur, las marcas de otras tiendas leakearían. Opciones:
  - (A) Aceptar la regresión y usar Fase B para restaurar via runtime contract.
  - (B) Importar desde `@minimalart/mercatto-multistore-contract` (verificar qué exporta hoy).
  - (C) Extender el runtime contract AHORA con helpers multistore.
- `SalesChannelMultiSelect` (para asignar marca a canales) removido del create-drawer — reemplazado por placeholder. Requiere Fase B o vendor local.
- `ExtensionVersion` badge removido — cosmético, no bloquea.

### Iteración 1

- **Inicio**: 2026-08-31 10:48:43
- **Fix aplicado**: reemplazado stub multistore fail-open por el shim real de plugin-comments (5 archivos: module-key, request, resolve-site, scope, types). Ajustados 3 imports en brand para apuntar a paths específicos.
- **Build docker**: intento 1 falló (Docker Desktop apagado — bloqueo 8 min esperando encendido). Intento 2 falló (prompt interactivo `The modules directories will be removed and reinstalled from scratch. Proceed?` que abortó install). Intento 3 OK con `CI=true` + `--config.confirm-modules-purge=false`.
- **Build result**: `pnpm install` 16m12s (instalación limpia en container fresco) + `pnpm build` 2m15s = ~19 min
- **Publish**: v1.0.0 a GH Packages OK
- **Host wiring**: `medusa-config.ts` (add plugin resolve + remove `optionalModule('brand','brand')`), `apps/backend/package.json` bump, deleted 13 in-tree files + extension source
- **Regen locks**: pnpm-lock (1m37s) + npm lock via /tmp isolated (~30s)
- **tsc**: backend + storefront ambos exit 0
- **PR abierto**: #878 a las 11:27:02
- **Duración iteración 1**: 38m 19s
- **Deuda técnica confirmada**: SiteScopeBar + SalesChannelMultiSelect + ExtensionVersion como TODO Fase B

### Bloqueos externos durante iter 1

| Motivo | Duración | Notas |
|---|---|---|
| Docker Desktop apagado | ~8 min | Requirió intervención del usuario |
| Prompt interactivo pnpm | ~2 min | Fix: `CI=true` + `--config.confirm-modules-purge=false` |

**Total bloqueos**: ~10 min (26% de la iteración)

### Cierre

- **PR merged**: 2026-08-31 ~11:29
- **Deploy iniciado**: 2026-08-31 11:30:18
- **Deploy #1 fallido**: ~11:33 UTC 14:33 — TS2307 en `apps/backend/src/api/extension-middlewares.ts:14` (import stale)
- **Detectado por user**: 11:54:08
- **Hotfix #879 (extension-middlewares)**: commit 11:57:16, PR 11:57:39, merged 11:58:00
- **Deploy #2 fallido**: 11:59+ — rollup no resolvió `../translations/brands` desde `src/admin/i18n/index.ts`
- **Detectado por user**: ~12:06
- **Hotfix #881 (i18n + hooks/api + extension-versions)**: commit 12:08:44, PR 12:09:03
- **Hotfix #880 (catalogador workspace ref)**: PR 12:02 (fix workspace-only, NO bloquea DO)
- **Deploy verde**: _pendiente merge de #881_
- **Verificado en prod**: _pendiente checklist del user_

### Cierre

- **Publicado**: 2026-08-31 11:24 (build) / 11:24 (npm publish)
- **Deploy verde**: _pendiente_
- **Duración compute PR abierto**: 10:33:43 → 11:27:02 = 53m 19s
- **Duración con hotfixes**: _pendiente cierre_
- **Iteraciones reales**: 1 (código) + 2 (hotfixes por leftovers) — el patrón "borrar in-tree" tiene fuga de refs
- **Aprendizaje crítico v1**: antes de commitear una migración de plugin, correr grep en `extension-middlewares.ts`, `i18n/index.ts`, `hooks/api/index.ts`, `lib/extension-versions.ts`. Local tsc **no** captura porque el bundle admin lo compila Rollup (más estricto que tsc para ESM).

- **Aprendizaje crítico v2** (post PR #883, blog): el grep del v1 es insuficiente. Otros módulos in-tree importan con paths bare relativos (`'../../../blog'`, `'../../blog/service'`) que **no contienen el string literal `modules/blog`**. Grep correcto:
  ```bash
  grep -rEn "from ['\"](\.\.?/)+(blog|brands|comments)[/'\"]" apps/backend/src apps/storefront/src
  ```
  Cubre paths bare relativos a cualquier profundidad, no solo los que atraviesan `modules/`. Además si algún módulo importa helpers reales del plugin migrado (`renderXxx`, `getXxxExtensions`, etc.), **restaurar como shim dormant** el módulo in-tree (mismo patrón que translations/blog + product-selector.tsx en PR #882).

---

## Plugin 2: blog

- **Extension origen**: `packages/extensions/blog` v1.5.0 (56 files TS)
- **Deps**: `media-library` ✅ ya migrado
- **Superficie**: módulo `blog`, admin routes `/blog-posts` `/blog-categories` `/blog-settings`, storefront pages

### Scaffold

- **Inicio scaffold**: 2026-08-31 11:31:56 (en paralelo con deploy de brands)
- **Fin scaffold**: 2026-08-31 11:39:38
- **Duración**: 7 min 42 s ⚡ (aprendizaje: usando plugin-brands como plantilla + shim vendored ya conocido acelera vs primer scaffold que fue 13 min)

**Deuda técnica detectada** (menor que brands, mismo patrón):
- `SiteScopeBar` + `ExtensionVersion` en `articles/page.tsx` → TODO Fase B
- `SalesChannelMultiSelect` en `articles/[id]/page.tsx` → TODO Fase B (state preservado)
- Runtime deps agregadas: Tiptap 2.x, dnd-kit, sanitize-html — verificar rangos contra el host en iter 1
- `src/api/middlewares.ts` root vacío (el blog no usa `validateAndTransformBody`, los validators corren inline con `zod.parse(req.body)`)
- Todas las migrations respetan el naming (grandfathered pre-cutoff o con sufijo `Blog`/`BlogCategory`)

### Iteración 1

- **Inicio**: 2026-08-31 11:59:09 (durante hotfix de brands)
- **Multistore shim**: copiado de plugin-comments
- **Build docker**: intento 1 falló por leftover PR #878 en `catalogador/package.json` workspace ref stale. Fix vía PR #880.
- **Build docker**: intento 2 OK con `CI=true` (~10 min build)
- **Publish**: v1.0.0
- **Host wiring**: medusa-config + apps/backend/package.json + delete 13 in-tree + delete extension source + PRESERVADOS `translations/blog/` y `admin/components/blog/product-selector.tsx` para banners AI drawer
- **Fixes bonus incluidos**: banners/package.json workspace ref, refs stale de brands #879/#881 (aplicados localmente coincidentes)
- **PR abierto**: #882 a las 12:32:18
- **Rebase**: main tenía #881 mergeado en paralelo → rebase limpio, force push 12:39:54
- **PR merged**: 12:42

### Cierre

- **Deploy #1 fallido**: 12:43 — `ai-assistant/{native-tools/index,workflow-engine}.ts` importan helpers reales de blog (`getBlogEditorExtensions`, `renderBlogContentHtml`, `BlogModuleService`, `BLOG_MODULE`). Grep del v1 no los cazó por paths bare relativos.
- **Hotfix #883**: shim dormant de `modules/blog/`. Commit 12:50:22, merged 12:53.
- **Deploy #2 verde**: 13:12:55
- **Duración compute PR abierto**: 11:31:56 → 12:32:18 = **1h 0min 22s**
- **Duración con hotfixes**: 11:31:56 → 12:53 = **1h 21min**
- **Iteraciones reales**: 1 código + 1 hotfix
- **Aprendizaje crítico v2**: cross-module consumers usan paths bare relativos. Grep debe cubrir cualquier depth y detectar cuando el consumer importa helpers reales → señal de shim dormant.

---

## Plugin 3: landing-pages

- **Extension origen**: `packages/extensions/landing-pages` v1.5.0 (40 files TS)
- **Deps**: media-library ✅
- **Env vars**: LANDING_AI_MAX_RETRIES, OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_SITE_URL
- **Superficie**: módulo `landing_page` (singular), 5 rutas AI, editor Puck, cross-module consumers en banner AI y ai-assistant

### Análisis pre-scaffold (aplicando aprendizaje v2)

10 imports cross-module detectados hacia `landing-page/ai/*` desde banner AI + ai-assistant. Decisión: shim dormant desde arranque.

### Scaffold

- **Inicio**: 13:05:15
- **Fin**: 13:18:19
- **Duración**: **13 min 4 s** (delegado con instrucciones detalladas + foreign modules pattern)

**Deuda técnica**:
- Foreign modules shim nuevo: `STORE_CONFIG_MODULE` literal + `StoreConfigLike` type
- `settings.ts` reescrito a env-only

### Iteración 1

Cinco fixes intercalados durante el build:
- **Build fail #1**: banners/package.json workspace ref stale a `@repo/extension-landing-pages`
- **Build fail #2**: chicken-and-egg de `apps/backend/package.json` bumpeado antes del publish → solución: **build isolated con `--ignore-workspace`**
- **Build fail #3**: `@measured/puck` no estaba en dependencies del plugin (scaffold missed). Agregado 0.20.2
- **Build fail #3b**: TS2322 en `ai-image/route.ts` — image_quality/image_max_kb declarados opcionales en `StoreConfigAiConfig`. Marcados required
- **Build fail #4**: `lib/puck/config.tsx` (655 líneas) faltaba en el plugin — copiado del host (email-config y home-config quedan en host para otros extensions)
- **Build fail #5**: `lib/client.ts` (SDK vendored) faltaba. Copiado de plugin-blog
- **Build OK**: 14:11:39
- **Publish + host wiring + tsc + PR**: 14:12 → 14:16:42
- **Rebase preventivo**: main incorporó #884 store-config antes del merge. Rebase limpio (mi extension-versions.ts NO colisionó)

### Cierre

- **PR abierto**: #885 a las 14:16:42
- **Duración iter 1**: 13:18:19 → 14:16:42 = **58 min 23 s**
- **Duración scaffold + iter 1**: **1h 11min 27s**
- **Iteraciones reales**: 1 código + 5 mini-fixes en local (no requirieron hotfix post-merge)
- **Merged**: ~14:30
- **Deploy fail**: `create-landing-page.js` dynamic import en `ai-assistant/artifact-tools.ts` — detectado con fresh `pnpm install` + tsc en main
- **Hotfix #887**: workflow shim preservado en host. Commit 15:27:38, PR 15:28:03
- **Deploy verde**: pendiente merge #887
- **Aprendizaje crítico v3**: chicken-and-egg de package.json bumpeado antes del publish → `--ignore-workspace` para primer build. Verificar `dependencies` del plugin post-scaffold para catch de libs runtime.
- **Aprendizaje crítico v4**: dynamic imports con `.js` extension explícita no aparecen en grep normal. Buscar también:
  ```bash
  grep -rn "import(['\"].*plugin-name.*['\"])" apps/backend/src apps/storefront/src
  ```

---

## Plugin 4: banners

- **Extension origen**: `packages/extensions/banners` v1.6.0
- **Deps**: media-library ✅, landing-pages ✅, blog ✅
- **Superficie**: módulo `banner`, admin routes `/banners` + `/banners/[placement]`, AI compose drawer que reusa product-selector + translations de blog

### Análisis pre-scaffold (aplicando aprendizajes v1-v4)

**Grep v2 (bare relative)**:
- `modules/ai-assistant/ai/campaign-enrich.ts` → `BANNER_MODULE` constant

**Grep v4 (dynamic imports)**:
- `modules/ai-assistant/ai/native-tools/artifact-tools.ts:99` → `await import('.../workflows/create-banner.js')`

**Workflows a preservar como shim host**: `create-banner.ts` (mismo patrón que create-landing-page).

**Vendoreo en plugin** (bonus cleanup post-migración):
- Copiar `admin/components/blog/product-selector.tsx` a plugin-banners (drawer AI lo usa)
- Copiar `admin/translations/blog/index.ts` a plugin-banners (drawer registra ambas)
- Después de banners deployado, BORRAR ambos shims del host (los ownaba blog, pero solo banners los usaba)

**Workspace deps**: `packages/extensions/banners/package.json` ya está limpio.

### Scaffold

- **Inicio**: 2026-08-31 15:43:33
- _en progreso_
