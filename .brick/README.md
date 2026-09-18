# `.brick/` — Brick como upstream de las tiendas

Este directorio es el contrato entre este repo (**Brick**) y las tiendas que se
construyen a partir de él. Lo lee el Brick Update Manager del
`minimalart-version-checker`, que abre y valida los PRs de actualización.

JSON no admite comentarios, así que el *por qué* de cada decisión vive acá.

## `config.json`

```json
{ "schema_version": 1, "role": "brick", "version": "1.0.0" }
```

`role: "brick"` es lo que distingue este repo de una tienda: una tienda lleva un
`config.json` con bloque `upstream` (de qué release salió) y bloque `custom`.

`version` **tiene que coincidir con el tag** del release. `release.yml` lo
verifica y aborta si no: un tag `v1.2.0` con `version: 1.1.0` adentro haría que
cada tienda adoptada reporte una versión instalada que no existe.

## `policy.json`

Clasifica cada archivo del repo en una de cinco clases. **Gana el primer match**,
en este orden:

```
brick_meta (.brick/config.json) → ignored → generated → config → custom → managed
```

La regla de fondo es **`tienda = Brick + config`**: salvo lo que esta política
exceptúa, cada archivo de la tienda tiene que ser byte-idéntico al de Brick. Lo
que no lo es, es *drift* y bloquea la actualización.

### `managed` — `**`

El default. Brick es dueño del archivo: la actualización lo pisa, y si Brick lo
borró, se borra en la tienda.

### `config` — difiere por tienda *por diseño*

No es "lo que está desactualizado", es "lo que nunca puede ser igual". Medido
contra `desdeelsur`, `vital` y `educabot` sobre `main` (2026-09-16):

| Archivo | Por qué |
| --- | --- |
| `README.md` | Cada tienda se presenta como sí misma. Difiere en las 3. |
| `.github/workflows/deploy-front.yml` | Proyecto de Vercel propio. Difiere en las 3. |
| `.github/workflows/deploy-backend.yml` | Sólo cambia `app_name` (`mercatto-backend` → `vital`). Es el nombre de la app en DigitalOcean. |
| `apps/backend/medusa-config.ts` | Módulos habilitados por tienda. |
| `apps/backend/package.json`, `apps/storefront/package.json` | El set de plugins instalados difiere por tienda. **Es lo que edita `plugin-upgrade`.** |
| `packages/project-catalog/src/catalog.json` | Catálogo de lo que la tienda tiene activo. |
| `apps/backend/src/lib/platform/catalog.json` | Ídem, del lado de la plataforma. |
| `apps/backend/src/admin/lib/extension-versions.ts` | Versiones de extensiones por tienda. |

**Trade-off asumido**: un bump de dependencias de Brick en esos `package.json` no
se propaga solo. La estrategia `merge: json-deps` (que reusaría
`_shared/pluginUpgrade.ts`) queda para v1.1.

`.github/workflows/publish-plugin.yml` **no** está acá aunque hoy difiera en
`vital` y `educabot`: la diferencia es una línea de atraso, no configuración. Se
queda `managed` para que la próxima actualización la empareje.

### `generated` — lo produce una herramienta, no una persona

`pnpm-lock.yaml` y `**/package-lock.json`. El engine los copia de Brick sólo si
los *importers* del lock de Brick son un subconjunto de los directorios de
packages del árbol deseado (check `lock_importers`). Si no, los deja como están y
`brick-locks.yml` los regenera dentro del PR — que es el único lugar donde se
puede correr `pnpm`, porque una Edge Function de Deno no puede.

### `ignored` — Brick nunca lo agrega, la tienda se lo queda

| Glob | Por qué |
| --- | --- |
| `packages/plugins/**` | El set de plugins *montados in-tree* es decisión de cada tienda: Brick y `vital` tienen los 26, `desdeelsur` y `educabot` tienen 3 y consumen el resto desde GitHub Packages. Propagarlos metería 2.700 archivos que esas tiendas descartaron a propósito. |
| `.playwright-cli/**` | Ruido de herramienta local que quedó commiteado en `vital`. |

**`docs/`, `blueprints/` y `examples/` NO están acá**, a diferencia de lo que
asumía el plan original. Medido: son idénticos en las 3 tiendas (65, 1 y 2
archivos). Marcarlos `ignored` los congelaría para siempre; son `managed`.

El caso real de `docs/` es `vital`, que agregó 17 archivos propios bajo
`docs/vital/`. Eso es un archivo solo-en-tienda, no una clase: se resuelve con
una `project_path_exception` sobre `docs/vital/**` o incluyéndolo en
`custom.paths` al adoptar, no relajando la política para todos.

### `custom` — código propio de la tienda, autorizado explícitamente

`apps/backend/src/custom/**` y `apps/storefront/src/custom/**`. **Hoy ninguno de
los dos existe en Brick ni en ninguna tienda**: la clase está declarada de
antemano para que, cuando aparezca el primer caso real, el path ya tenga
semántica. Sólo cuenta si la tienda tiene `custom.enabled: true` en su
`config.json` y el path matchea `custom.paths`; si no, es drift.

`.brick/policy.json` es `managed` a propósito: cada tienda lleva la política con
la que fue construida, y actualizarla es parte de actualizar.

### `validation`

- `required_checks: ["quality"]` — el check que ya bloquea todo PR en estos repos.
- `full_build_check: "brick-validate"` — el build completo en el runner propio,
  que sólo corre cuando el PR lleva la etiqueta `brick:full-validation`.
- `mode: "auto"` — la etiqueta se pone sola cuando el cambio toca algo de
  `full_build_triggers` (deps, toolchain, migraciones, workflows, patches).
  `"always"` la pondría en cada actualización.
