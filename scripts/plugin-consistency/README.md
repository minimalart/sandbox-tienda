# plugin-consistency (vendored)

**Este directorio es un mirror del script canónico que vive en**
`minimalart/minimalart-version-checker` en
`scripts/plugin-consistency/check.mjs`.

## ¿Por qué vendorear?

El checker es un repo privado. El CI del boilerplate corre con el
`GITHUB_TOKEN` default, que solo tiene permisos sobre este repo — no
puede clonar el checker. Vendorear elimina la dependencia cross-repo y
hace que el workflow funcione sin credenciales extra.

Trade-off aceptado: hay dos copias del mismo archivo. La regla es que
**el checker es la fuente de verdad** y este directorio es el mirror.
Cuando el script cambie en el checker, alguien tiene que copiar
`check.mjs` acá y abrir un PR.

## Cómo sincronizar

```bash
cp ../minimalart-version-checker/scripts/plugin-consistency/check.mjs \
   scripts/plugin-consistency/check.mjs
git add scripts/plugin-consistency/check.mjs
git commit -m "chore(ci): sync vendored plugin-consistency check.mjs"
```

Después abrir un PR con nota del hash del commit del checker que se
está sincronizando. Como el script es chico (~600 líneas) y estable,
esto pasa pocas veces por año.

## Uso

Ver la doc principal en `docs/plugin-consistency.md`.

```bash
node scripts/plugin-consistency/check.mjs                    # audit local
node scripts/plugin-consistency/check.mjs --fix              # auto-repair
node scripts/plugin-consistency/check.mjs --only <plugin>    # solo un plugin
node scripts/plugin-consistency/check.mjs --json             # CI-friendly
```

`--boilerplate <path>` no hace falta cuando corrés desde la raíz del
boilerplate — el default `../../../medusa-b2c-boilerplate` se resuelve
al mismo repo si el path relativo colapsa. Si te falla, pasá
`--boilerplate .` explícito.
