# Project Creator

A versioned `project.json` manifest describes a project: identity, commerce defaults, one template, and the selected extensions. Write it by hand following `project.schema.json` (see `examples/minimal.project.json`). The file contains no secrets and is passed to `pnpm site:create --manifest ... --output ...`.

Available templates and extensions are listed in `packages/project-catalog/src/catalog.json`, and are also visible in the Admin under **Sitio → Temas / Extensiones**.
