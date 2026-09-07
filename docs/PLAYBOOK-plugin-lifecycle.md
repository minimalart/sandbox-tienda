# Playbook — Ciclo de vida de un plugin Mercatto

> **Nota** — este playbook referencia otros docs del ecosistema Mercatto
> (`PLAN-mantenibilidad-y-escalabilidad.md`, `BLUEPRINT-*`, `PROCESO-*`) que
> **no viven en este repo**. La copia canónica de todos ellos, incluido este
> playbook, vive en el `minimalart-version-checker`:
> <https://github.com/minimalart/minimalart-version-checker/tree/main/docs>.
> Los links relativos que aparecen abajo resuelven correctamente ahí; en el
> boilerplate podés seguir los mismos nombres de archivo desde el repo del
> checker.

**Objetivo**: cerrar el flujo end-to-end de un plugin para que nunca queden
"orphans" — piezas publicadas en GH Packages sin declarar en el catálogo, o
declaradas sin código, o consumidas sin bumpear los 7 lugares.

Este playbook cubre desde **crear un plugin nuevo** hasta **verificar que el
version-checker no marque nada raro**. Complementa a `PROCESO-migracion-
extension-a-plugin.md` (que cubre solo la migración de extension existente
→ plugin) con el flujo completo, incluyendo publishing, consumo, declaración
y sync a tiendas.

> **Contexto del `catalog v2`** — desde el 2026-08-20 el
> `packages/project-catalog/src/catalog.json` usa `schema_version: 2` con dos
> campos por item: `type: "plugin" | "extension"` y `packageName` (solo si
> `type === "plugin"`). Ver [`PLAN §4.3`](./PLAN-mantenibilidad-y-escalabilidad.md#43-checklist-obligatorio-para-todo-bump-de-plugin-7-lugares).

---

## 1. Cuándo un ítem es plugin (Camino B) vs extension (Camino A)

Antes de escribir nada, decidí qué es.

**Camino B (plugin npm)** — el default:

- Package independiente publicable a GH Packages.
- Semver propio, tables propias, migrations propias.
- Se consume por `pnpm add @minimalart/mercatto-plugin-<id>`.
- Opt-in por tienda: si no está en el `package.json`, no viaja.

**Camino A (extension in-tree)** — solo si:

- Acoplamiento profundo con core Medusa (extiende ProductService, etc).
- Contratos con storefront que romperían si se convierte en plugin.
- Muy pocas líneas para justificar overhead de publicación.
- El intento de plugin daría un artefacto frágil.

Detalle completo en [`PLAN §3`](./PLAN-mantenibilidad-y-escalabilidad.md#3-los-dos-caminos-camino-a-base-sync--camino-b-plugin-npm).

Si sos Camino A, este playbook no aplica — usá el flujo de `packages/extensions/`.

---

## 2. Los 7 lugares que quedan sincronizados

Cada bump o creación de plugin toca **exactamente estos 7 archivos**. Si te
salteás uno, el version-checker (o algo peor) lo va a cazar después.

| # | Archivo | Qué se edita |
|---|---------|--------------|
| 1 | `packages/plugins/plugin-<id>/package.json` | `"version": "X.Y.Z"` — release del npm package |
| 2 | `packages/plugins/plugin-<id>/mercatto-plugin.json` | `"version": "X.Y.Z"` — manifest interno |
| 3 | `packages/plugins/plugin-<id>/CHANGELOG.md` | Nueva entrada `## [X.Y.Z] - fecha` |
| 4 | `apps/backend/package.json` | `"@minimalart/mercatto-plugin-<id>": "^X.Y.Z"` en `dependencies` |
| 5 | `apps/backend/src/admin/lib/extension-versions.ts` | `<id>: 'X.Y.Z'` — badge del sidebar |
| 6 | `packages/project-catalog/src/catalog.json` | Entry del item con `"version"`, `"type"`, `"packageName"` |
| 7 | `apps/backend/src/lib/platform/catalog.json` | **Mirror byte-a-byte** del anterior |

Sanity check antes de merge:

```powershell
$id = "loyalty"; $ver = "1.1.0"
Select-String -Path "packages\plugins\plugin-$id\package.json",`
  "packages\plugins\plugin-$id\mercatto-plugin.json",`
  "apps\backend\src\admin\lib\extension-versions.ts",`
  "packages\project-catalog\src\catalog.json",`
  "apps\backend\src\lib\platform\catalog.json" -Pattern "$ver" |
  Format-Table Path,Line
```

Los 7 archivos deben tener la misma version. Si alguno divergió, freezaste el drift.

---

## 3. Ciclo de vida — 8 fases

### Fase 1 — Scaffold del plugin

Crear el dir con la estructura canónica:

```
packages/plugins/plugin-<id>/
├── package.json                    ← name: @minimalart/mercatto-plugin-<id>
├── mercatto-plugin.json            ← manifest interno
├── CHANGELOG.md                    ← empieza con "## Unreleased"
├── README.md
├── tsconfig.json
├── src/
│   ├── index.ts                    ← module registration
│   ├── modules/<id>/               ← Medusa module
│   ├── api/                        ← rutas admin/store
│   ├── admin/                      ← widgets, routes, etc
│   ├── subscribers/
│   ├── workflows/
│   └── migrations/                 ← nombres <TS><ModulePascal>.ts
└── .medusa/                        ← build output (gitignored en source, incluido al publish)
```

**Estructura del `package.json`**:

```json
{
  "name": "@minimalart/mercatto-plugin-<id>",
  "version": "1.0.0",
  "description": "<descripción corta>",
  "main": ".medusa/server/src/index.js",
  "types": ".medusa/server/src/index.d.ts",
  "files": [".medusa/server", "src"],
  "publishConfig": {
    "registry": "https://npm.pkg.github.com/",
    "access": "public"
  },
  "scripts": {
    "build": "medusa plugin:build",
    "prepublishOnly": "pnpm run build"
  },
  "peerDependencies": {
    "@medusajs/framework": "^2.18.0",
    "@medusajs/medusa": "^2.18.0",
    "@medusajs/admin-sdk": "^2.18.0",
    "@medusajs/js-sdk": "^2.18.0",
    "@medusajs/ui": "^4.0.0",
    "react": "^19.0.0"
  }
}
```

Detalle de estructura en [`BLUEPRINT-estructura-plugins-y-extensiones.md`](./BLUEPRINT-estructura-plugins-y-extensiones.md).

### Fase 2 — Desarrollo local con `yalc`

Nunca publicar hasta tener smoke test end-to-end. Usar `yalc` para consumir
el plugin como si fuera npm sin publicarlo:

```powershell
cd packages/plugins/plugin-<id>
pnpm build
yalc publish

cd ../../../apps/backend
yalc add @minimalart/mercatto-plugin-<id>
pnpm install
pnpm dev
```

Cuando iterás:

```powershell
cd packages/plugins/plugin-<id>
pnpm build
yalc push   # empuja a todos los consumers
```

Verificar que:

1. El backend arranca sin errores.
2. Las migrations corren limpio (`medusa db:migrate`).
3. Los endpoints del plugin responden.
4. El admin sidebar muestra los routes del plugin.
5. Multi-tenant funciona (si aplica) — headers `x-site-id`, SiteScopeBar
   vendorizada, etc.

**Reglas del yalc dev**:

- `apps/backend/.yalc/` y `apps/backend/yalc.lock` viven en `.gitignore`.
  Nunca committear.
- Antes de merge del PR de bump, remover el `file:.yalc/...` del
  `package.json` y volver a poner el semver real (`^X.Y.Z`).

### Fase 3 — Publish a GH Packages

Cuando el smoke test cierra:

1. **Bump del `package.json`** del plugin: `version: "1.0.0"` → `"1.1.0"`.
2. **Bump del `mercatto-plugin.json`** interno: misma version.
3. **Entry al `CHANGELOG.md`**:

    ```markdown
    ## [1.1.0] - 2026-08-20

    ### Added
    - Descripción del cambio.
    ```

4. **Publish** (manual o via CI):

    ```powershell
    cd packages/plugins/plugin-<id>
    pnpm build
    npm publish
    ```

    El `.npmrc` del monorepo debe estar apuntando al scope `@minimalart` a
    `npm.pkg.github.com`. El token de publish necesita `write:packages` en
    la GH App / PAT del CI.

5. **Verificar en GH Packages**: la version publicada aparece en
   `https://github.com/orgs/minimalart/packages/npm/mercatto-plugin-<id>/versions`.

**No mergear al `main` del boilerplate sin haber publicado primero.** El PR del
consumo referencia una version que tiene que estar disponible.

### Fase 4 — Consumir el plugin en `apps/backend`

Editar `apps/backend/package.json`:

```json
"dependencies": {
  "@minimalart/mercatto-plugin-<id>": "^1.1.0",
  ...
}
```

Y en `apps/backend/medusa-config.ts`, agregar al array `plugins[]`:

```typescript
plugins: [
  ...,
  { resolve: "@minimalart/mercatto-plugin-<id>" },
]
```

Regenerar `pnpm-lock.yaml`:

```powershell
cd apps/backend
pnpm install
```

### Fase 5 — Declarar en `catalog.json` (schema v2)

**Este es el paso que se olvida más seguido.** Editar
`packages/project-catalog/src/catalog.json` y agregar/actualizar el item en
`extensions[]`:

```json
{
  "id": "<id>",
  "name": "<Nombre visible>",
  "version": "1.1.0",
  "type": "plugin",
  "packageName": "@minimalart/mercatto-plugin-<id>",
  "status": "ready",
  "category": "<categoria>",
  "description": "<descripción>",
  "dependencies": []
}
```

**Reglas del catálogo v2**:

- `type` es **obligatorio**: `"plugin"` o `"extension"`.
- `packageName` es **obligatorio si `type === "plugin"`** y debe ser el nombre
  publicado en GH Packages (no el id).
- `version` debe coincidir con lo publicado en la fase 3 y con el `package.json`
  del plugin.

Copiar el archivo tal cual al mirror runtime:

```powershell
Copy-Item packages\project-catalog\src\catalog.json apps\backend\src\lib\platform\catalog.json
```

Ambos deben ser byte-idénticos. El version-checker verifica esto.

### Fase 6 — CHANGELOG.md + docs

- **`packages/plugins/plugin-<id>/CHANGELOG.md`**: entry para la version
  release. Es la memoria humana de "qué cambió y por qué" (§3 arriba).
- **`apps/backend/src/admin/lib/extension-versions.ts`**: agregar/actualizar
  `<id>: 'X.Y.Z'` — controla el badge que aparece en el admin sidebar.
- Si el plugin introduce features nuevas visibles: actualizar
  `apps/storefront/README.md` o `docs/` correspondientes.

### Fase 7 — Sanity check antes de merge

Con los 7 lugares tocados, correr el script de verificación (§2) y confirmar
que todos apuntan a la misma version.

Adicionalmente:

```powershell
pnpm typecheck            # el monorepo
pnpm test                 # migraciones + tests unit
cd apps/backend && pnpm dev  # arranca sin errores
```

Si todo pasa, PR con label `plugin-bump`. Reviewer verifica:

- [ ] Los 7 archivos alineados en version.
- [ ] `type: "plugin"` + `packageName` presentes en el catálogo.
- [ ] Version publicada en GH Packages (link en el PR body).
- [ ] CHANGELOG del plugin actualizado.
- [ ] `pnpm install` corre limpio (lockfile regen).
- [ ] Migraciones tienen `Migration<TS><ModulePascal>.ts` (previene colisión).

### Fase 8 — Sync a tiendas hijas

Después del merge, el `minimalart-version-checker` muestra que las tiendas
hijas están `behind` en el plugin (o `missing` si es plugin nuevo). Para cada
tienda:

1. Branch `plugin/upgrade-<id>-X.Y.Z` (o `plugin/install-<id>` si es nuevo).
2. `pnpm add @minimalart/mercatto-plugin-<id>@^X.Y.Z`.
3. Agregar entry en `medusa-config.ts.plugins[]` si install nuevo.
4. Actualizar `.mercatto-installed-plugins.json` (si aplica).
5. Copiar el `catalog.json` de la tienda desde el boilerplate (o sincronizar
   el item específico).
6. PR → review → merge → CI dispara deploy.

Detalle en [`PLAN §8.2, §8.3`](./PLAN-mantenibilidad-y-escalabilidad.md#8-playbooks-operativos).

---

## 4. Cómo el version-checker detecta gaps

El `minimalart-version-checker` cruza tres fuentes cada vez que hacés
"Comparar":

- **Declarado** (`catalog.json`) — qué dice el catálogo.
- **Codeado** (`packages/plugins/plugin-<id>/`) — qué hay físicamente en el
  repo.
- **Publicado** (GH Packages) — qué está disponible via npm.
- **Consumido** (`apps/backend/package.json` de cada tienda) — qué usa cada
  hija.

Y muestra badges en la Marketplace card cuando desalinean:

| Badge | Qué significa | Cómo se arregla |
|---|---|---|
| `⚠ code X.Y.Z` | catalog dice A, `packages/plugins/…/package.json` dice B | Actualizar catalog (paso 5 arriba) |
| `⚠ npm X.Y.Z` | GH Packages tiene una version más nueva que la del repo | Bump del plugin (fases 3-5) |
| `⚠ sin código` | catalog dice `type: "plugin"` pero no existe `packages/plugins/plugin-<id>/` | Crear el dir (fase 1) o cambiar el catalog a `extension` |
| `⚠ sin declarar` | `packages/plugins/plugin-<id>/` existe pero catalog no lo declara plugin | Agregar `type: "plugin"` + `packageName` al catalog (paso 5) |

Cualquier badge que aparezca en producción es una anomalía de sync entre las
4 fuentes. **No mergees un plugin sin correr una comparación en el checker
para verificar que ningún badge se prendió por descuido.**

---

## 5. Ejemplo real: caso `commerce-dashboard` (el que motivó este playbook)

El 2026-08-20, el version-checker mostró un badge `⚠ sin declarar` en el
Marketplace: el plugin `commerce-dashboard` estaba:

- ✅ Publicado en GH Packages como `@minimalart/mercatto-plugin-commerce-dashboard@1.3.0`.
- ✅ Con dir físico en `packages/plugins/plugin-commerce-dashboard/`.
- ✅ Consumido por `apps/backend/package.json` en `^1.3.0`.
- ❌ **Marcado como `type: "extension"`** en `catalog.json`, sin `packageName`.

Se saltearon los pasos 5 y 7 de la fase 5 al hacer el bump de v2 del catalog:
las tres piezas alineadas pero el catálogo desactualizado.

**Fix**: PR que cambia el catálogo:

```diff
-    { "id": "commerce-dashboard", "name": "Commerce dashboard", "version": "1.3.0", ..., "type": "extension" },
+    { "id": "commerce-dashboard", "name": "Commerce dashboard", "version": "1.3.0", ..., "type": "plugin", "packageName": "@minimalart/mercatto-plugin-commerce-dashboard" },
```

Y el mismo cambio en el mirror `apps/backend/src/lib/platform/catalog.json`.

Post-merge, el badge desaparece del checker.

**Prevención**: seguir este playbook al crear/bumpear un plugin. Los pasos 5
y 7 son los que se olvidan más — el reviewer debería tildarlos explícitamente
en el checklist del PR.

---

## 6. Reglas duras (no negociables)

Del [`PLAN §6.1`](./PLAN-mantenibilidad-y-escalabilidad.md#61-reglas-duras-no-negociables):

1. **Cero imports plugin↔plugin** — event bus o workflows únicamente.
2. **Migraciones con sufijo del módulo** — `Migration<TS><ModulePascal>.ts`
   (mikro_orm_migrations es global).
3. **Plugin sigue semver del base** — un major del boilerplate exige major
   del plugin.
4. **No auto-merge en PRs de plugin bump** — siempre review humano.
5. **Sin migrations destructivas sin backup previo** — `DROP TABLE` bloquea
   el PR salvo aprobación explícita.
6. **`.pre-plugin-backup` prohibido** — git es el backup.
7. **Root del store tiene los 2 manifests** — `.mercatto-base-version.json`
   + `.mercatto-installed-plugins.json` committeados, editados solo por el
   pivot.

---

## 7. Anti-patterns (qué NO hacer)

- ❌ **Publicar a GH Packages antes de tener smoke test local con yalc.**
  Revert de una version publicada es doloroso.
- ❌ **Bumpear `apps/backend/package.json` para depender de una version que
  todavía no publicaste.** El siguiente `pnpm install` explota.
- ❌ **Editar solo `packages/project-catalog/src/catalog.json` sin
  actualizar el mirror en `apps/backend/src/lib/platform/`.** Los dos se
  usan en tiempos distintos — uno en build, otro en runtime — y desalineados
  causan drift silencioso.
- ❌ **Bumpear un plugin sin entry en `CHANGELOG.md` del plugin.**
  Genera memoria colectiva perdida.
- ❌ **Push a `main` del plugin sin PR review.** Aplica hasta el `contact`
  y `loyalty`, no hacer excepciones nuevas.
- ❌ **Symlinks o workspace-hacks para "acelerar" el consumo local.**
  yalc existe justamente para eso, y los symlinks no sobreviven al build de
  producción.

---

## 8. Referencias cruzadas

- [`PLAN-mantenibilidad-y-escalabilidad.md`](./PLAN-mantenibilidad-y-escalabilidad.md) — visión completa del ecosistema.
- [`PROCESO-migracion-extension-a-plugin.md`](./PROCESO-migracion-extension-a-plugin.md) — migrar una extension existente a plugin.
- [`BLUEPRINT-estructura-plugins-y-extensiones.md`](./BLUEPRINT-estructura-plugins-y-extensiones.md) — estructura canónica de dirs y manifests.
- [`PRD-plugin-conversion-and-base-sync.md`](./PRD-plugin-conversion-and-base-sync.md) — motivación arquitectónica original.
- Version-checker deployado (Vercel) — verificar que ningún badge está prendido antes de merge.

---

## 9. Checklist final (para pegar en el PR body)

```markdown
### Plugin lifecycle checklist

- [ ] Plugin dir con estructura canónica en `packages/plugins/plugin-<id>/`
- [ ] `package.json` con name, version, files, publishConfig correctos
- [ ] `mercatto-plugin.json` con misma version
- [ ] `CHANGELOG.md` con entrada `## [X.Y.Z] - fecha`
- [ ] Smoke test end-to-end con yalc (backend arranca, migrations OK, endpoints OK)
- [ ] Publicado a GH Packages y verificado en la UI de la org
- [ ] `apps/backend/package.json` bumpeado a `^X.Y.Z`
- [ ] `apps/backend/medusa-config.ts` incluye el plugin
- [ ] `apps/backend/src/admin/lib/extension-versions.ts` actualizado
- [ ] `packages/project-catalog/src/catalog.json` con `type: "plugin"` + `packageName` + version
- [ ] `apps/backend/src/lib/platform/catalog.json` idéntico al anterior
- [ ] Sanity script de 7 lugares muestra la misma version en todos
- [ ] `pnpm typecheck` + `pnpm test` pasan
- [ ] Version-checker (Vercel) no muestra badges de drift para este plugin
```
