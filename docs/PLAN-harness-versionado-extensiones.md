# Plan — Harness de versionado para extensions

> **Estado**: propuesta, no implementado. Encarar después de terminar la ola tier-A de migración a plugins.

## El problema

Los plugins publicados a GH Packages tienen una forcing function natural para versionado: `npm publish` no permite reusar un `version`, así que cualquier cambio al código obliga a bumpear + escribir CHANGELOG. La disciplina emerge sola.

Las extensions viven en `packages/extensions/*` y se distribuyen por copia de archivos vía `composer apply`. No hay `npm publish` en el medio, así que:

- Se hacen fixes al código sin tocar `version` en `mercatto-component.json`.
- No hay `CHANGELOG.md` obligatorio por extensión.
- El `minimalart-version-checker` (repo adyacente `mercatto-consolidated/minimalart-version-checker`) compara versions entre boilerplate y proyecto hijo, así que un fix sin bump queda invisible para el sistema.
- La tienda hija sigue creyendo que está al día cuando en realidad tiene código viejo con bugs conocidos.

El plugin lifecycle ya resuelve esto. El extension lifecycle no. Este plan replica la forcing function para extensions **sin publicarlas como packages**.

## Propuesta

Tres piezas independientes, se pueden implementar en fases.

### Pieza 1 — `payload_hash` en `mercatto-component.json`

Nuevo campo al descriptor:

```json
{
  "schema_version": 1,
  "id": "recurring-orders",
  "version": "1.6.0",
  "payload_hash": "sha256:8f7ed47c42ac570b4d3c45a04f0dd5e34afe2cc2",
  ...
}
```

**Regla de cómputo**: SHA-256 sobre el contenido concatenado de `payload/**` en orden alfabético del path relativo, EXCLUYENDO el propio `mercatto-component.json` (para no meter recursión).

**Herramienta**: `scripts/extensions/regen-payload-hash.mjs`. Uso:

```bash
# Regen manual después de un fix
node scripts/extensions/regen-payload-hash.mjs recurring-orders

# Regen + bump patch
node scripts/extensions/regen-payload-hash.mjs recurring-orders --bump patch

# Regen todas (bootstrap inicial)
node scripts/extensions/regen-payload-hash.mjs --all
```

El bump automático edita el `version` semver siguiendo la convención estándar (patch|minor|major). El operador escribe la entry en `CHANGELOG.md`.

### Pieza 2 — Test de sincronía `payload-hash.test.ts`

Ubicación: junto a los otros tests de disciplina del repo (`migration-names.test.ts`, `docs-sync.test.ts`).

Comportamiento:

1. Recorre `packages/extensions/*/mercatto-component.json`.
2. Recomputa el hash del payload actual.
3. Compara contra el `payload_hash` declarado en el descriptor.
4. Si no coincide: falla el test con un mensaje claro:

   > La extensión `X` fue modificada sin regenerar el hash ni bumpear la versión.
   >
   > Correr: `node scripts/extensions/regen-payload-hash.mjs X --bump patch`
   > Después: agregar entry en `packages/extensions/X/CHANGELOG.md`.

5. Adicionalmente: verifica que el `version` declarado tenga una entry correspondiente en `CHANGELOG.md`.

**Corre en `pnpm test`**. Falla el CI si un PR modifica una extensión sin cumplir la disciplina.

### Pieza 3 — `CHANGELOG.md` obligatorio por extensión

Convención: cada `packages/extensions/<X>/` debe tener un `CHANGELOG.md` al mismo nivel que `mercatto-component.json`.

Bootstrap: script `scripts/extensions/bootstrap-changelog.mjs` que genera skeleton desde `git log --format="%s" -- packages/extensions/<X>/` para cada extensión existente. El operador después limpia y publica.

Formato mínimo (mismo que plugins):

```markdown
# Changelog

## 1.6.0 - Descripción corta del cambio.

## 1.5.0 - Cambio anterior.
```

El test valida existencia de `CHANGELOG.md` y que la version del descriptor aparezca en un heading `##`.

## Cómo lo consume el version-checker

Hoy `minimalart-version-checker` compara `version` de la instancia hija contra `version` del boilerplate. Con estas piezas:

- **Además del `version`**, snapshotea el `payload_hash` de cada extensión de la instancia hija.
- Al comparar contra el boilerplate:
  - Versions distintas → update disponible (hoy).
  - Versions iguales pero hashes distintos → **drift silencioso**: alguien pusheó al boilerplate sin bumpear. Warn/alert.

Esa segunda condición es la que hoy no se puede detectar. Es la evidencia que faltaba.

## Rollout — fases

**Fase 0 — Bootstrap una sola vez**
1. Escribir `scripts/extensions/regen-payload-hash.mjs`
2. Correr con `--all` sobre todas las extensiones actuales. Commitea `payload_hash` en cada `mercatto-component.json`.
3. Escribir `scripts/extensions/bootstrap-changelog.mjs`
4. Correr sobre todas. El commit inicial tiene un `CHANGELOG.md` mínimo por extensión (skeleton generado desde git log).
5. PR único con todos los cambios de bootstrap.

**Fase 1 — Test blando**
6. Escribir `packages/extensions/payload-hash.test.ts` con `console.warn` cuando falla (no fail el CI todavía).
7. Merge. Durante 1–2 semanas ver cuántas extensiones se modifican sin disciplina.

**Fase 2 — Test duro**
8. Cambiar `console.warn` a `assert`. Falla el CI.
9. Agregar sección al `PLAYBOOK-plugin-lifecycle.md` documentando la disciplina.
10. Idealmente agregar sección análoga al `PROCESO-migracion-extension-a-plugin.md` para que cuando una extension se migre a plugin, su `CHANGELOG.md` viaje con ella.

**Fase 3 — Integración con version-checker**
11. Actualizar el schema del snapshot del checker para incluir `payload_hash`.
12. Update de la lógica de comparación para detectar drift.
13. Update de la UI del dashboard para mostrar el warning nuevo.

## Costo estimado

| Fase | Trabajo | Tiempo |
|---|---|---|
| 0 — Bootstrap | Scripts + regen inicial + CHANGELOG skeletons | 2–3h |
| 1 — Test blando | Test + doc breve | 1h |
| 2 — Test duro | Flip del assert + doc en PLAYBOOK | 30min |
| 3 — Version-checker | Update schema + lógica + UI | 2–3h (repo aparte) |
| **Total** | | **1 día enfocado** |

## Lo que este harness NO resuelve

- **NO evita** que alguien commitee un fix sin agregar entry al CHANGELOG. Solo evita que llegue a main sin bumpear la version + regenerar el hash. La entry misma queda a criterio del PR reviewer.
- **NO detecta** cambios semánticos (breaking vs no-breaking). El semver sigue siendo declarado a mano.
- **NO fuerza** un rollout coordinado entre boilerplate y proyectos hijos. Solo hace VISIBLE el drift.

## Alternativas descartadas y por qué

- **Publicar extensions como npm packages**: mismo problema que motivó la migración a plugins. Explota el número de packages en el registry y no aporta valor porque el composer apply sigue siendo copy-source.
- **Guardar hash fuera de `mercatto-component.json`** (sidecar file, registro central): duplica el lugar donde buscar; hacer el descriptor la source of truth es más ergónomico.
- **Hash automático regenerado en cada commit por un hook**: los hooks son opt-in por dev, no confiables. Un test en CI es evidencia dura.

## Cuándo encarar

Cuando la ola de migración tier-S y tier-A haya cerrado. Las extensions que quedan sin migrar en tier-B/C/D son las que más se van a beneficiar (siguen recibiendo fixes por mucho tiempo antes de convertirse en plugins). En ese punto el drift acumulado se vuelve visible y el harness paga.
