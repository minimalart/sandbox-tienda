# Plugin consistency — cómo funciona y cómo extenderlo

Toda vez que bumpeás la versión de un plugin del boilerplate tenés que
tocar **7 lugares** para que quede sincronizado. Ver
`PLAYBOOK-plugin-lifecycle.md §2`. La regla es simple pero fácil de
olvidar — este doc arma las tres capas que atrapan cualquier olvido.

## Los 7 lugares canónicos

Cada bump toca exactamente estos archivos:

| # | Archivo | Campo |
|---|------|-------|
| 1 | `packages/plugins/plugin-<id>/package.json` | `version` (**source of truth**) |
| 2 | `packages/plugins/plugin-<id>/mercatto-plugin.json` | `version` |
| 3 | `packages/plugins/plugin-<id>/CHANGELOG.md` | entrada nueva `[X.Y.Z]` |
| 4 | `apps/backend/package.json` | `dependencies["@minimalart/mercatto-plugin-<id>"]` |
| 5 | `apps/backend/src/admin/lib/extension-versions.ts` | comment `// <id>: moved to @minimalart/mercatto-plugin-<id>` |
| 6 | `packages/project-catalog/src/catalog.json` | `version`, `type: "plugin"`, `packageName` |
| 7 | `apps/backend/src/lib/platform/catalog.json` | mirror byte-idéntico de #6 |

## Tres capas de guardarraíl

### Capa 1 — Prevención en el bump (skill de Claude Code)

Cuando decís **"voy a publicar plugin loyalty a 1.2.0"** en Claude Code,
se dispara el skill `/plugin-publish` que camina 9 fases forzando cada
uno de los 7 lugares.

Vive en el checker repo: `.claude/skills/plugin-publish/SKILL.md`.

Funciona hoy. No requiere activación.

### Capa 2 — CI check en PRs (warning-only)

`.github/workflows/plugin-consistency.yml` se dispara en cada PR contra
`main` que toque los archivos canónicos. Corre
`scripts/plugin-consistency/check.mjs` del checker y **postea un
comentario sticky** en la PR listando cada finding.

**Es warning-only**: nunca bloquea el merge. La idea es que se pueda
mergear igual si el humano decide "ya lo voy a arreglar en otra PR", pero
que quede visible en el hilo que hay drift.

Si querés que bloquee, cambiar en el yaml:

```yaml
- name: Run consistency check
  continue-on-error: true   # → false
```

y agregar un step final que haga `exit 1` cuando hay findings.

Los paths que activan el check:

- `packages/plugins/**`
- `packages/project-catalog/**`
- `apps/backend/package.json`
- `apps/backend/src/admin/lib/extension-versions.ts`
- `apps/backend/src/lib/platform/catalog.json`
- `.github/workflows/plugin-consistency.yml` (self-trigger — cualquier PR que edite el check lo dispara)
- `docs/plugin-consistency.md` (idem para la doc)

### Capa 3 — Pre-push hook local (opcional, por developer)

Bloquea `git push` en tu máquina si hay drift. **No se sincroniza vía
git** (los hooks viven en `.git/hooks/`), así que cada developer lo
instala una vez.

Snippet mínimo (crear `.git/hooks/pre-push` con esto + `chmod +x`):

```bash
#!/usr/bin/env bash
set -e
node scripts/plugin-consistency/check.mjs --boilerplate . || {
  echo ""
  echo "🚫  Push blocked: plugin catalog inconsistencies detected."
  echo "    Fix with:"
  echo "      node scripts/plugin-consistency/check.mjs --boilerplate . --fix"
  echo "    Or push anyway with --no-verify (not recommended)."
  exit 1
}
```

## Cómo fixear cuando el CI se queja

**Opción A — auto-fix (recomendada para catalog stale y migraciones)**:

```bash
node scripts/plugin-consistency/check.mjs --boilerplate . --fix
git diff  # revisar
```

El script preserva el estilo compacto del catalog (una entry por línea).
Reescribe SOLO las líneas afectadas.

**Opción B — manual (para items 🟡 del reporte)**:

Los findings marcados como manual son mayormente en
`apps/backend/src/admin/lib/extension-versions.ts`:

- Si un plugin migrado quedó con **live key** (`contact: '1.4.0'`), hay
  que reemplazarla por un comment `// contact: moved to @minimalart/...`
- Si un plugin migrado no tiene ni key ni comment, agregar el comment en
  la posición alfabética correspondiente

El CHANGELOG (#3) también es manual — el script nunca inventa release notes.

## Cómo extender

### Agregar un nuevo path que debe chequear

Si sumás un archivo nuevo al proceso (ej: manifest global, config de
CI/CD del plugin, snapshot de types), agregarlo al `paths:` filter del
workflow:

```yaml
on:
  pull_request:
    branches: [main]
    paths:
      - 'packages/plugins/**'
      - 'packages/project-catalog/**'
      - 'apps/backend/package.json'
      - 'apps/backend/src/admin/lib/extension-versions.ts'
      - 'apps/backend/src/lib/platform/catalog.json'
      - 'tu/nuevo/path/**'                     # ← acá
```

Si el nuevo archivo también debe validarse contra el `package.json` del
plugin, hay que sumarlo también al script `check.mjs` en el checker repo.
Pattern: seguir la estructura de los checks 1-7 en
`scripts/plugin-consistency/check.mjs`.

### Cambiar del modo warning al modo blocking

Ver la sección "Capa 2" arriba.

### Personalizar el copy del comment

El comment se arma en el step `Build PR comment body` del yaml. Es JS
inline generando un markdown; editarlo directamente.

## Historial

- 2026-09-01 — Detección inicial de 12 plugins con drift (bundle J del
  checker, PR minimalart/minimalart-version-checker#24). Sweep manual en
  minimalart/medusa-b2c-boilerplate#897.
- Fecha del CI activation — este archivo + workflow.
