# Independent Medusa project generation

## Create a project

Write a `project.json` manifest by hand following `packages/project-creator/project.schema.json` (see `examples/minimal.project.json` for a starting point), then run:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "use-a-local-password"
corepack pnpm site:create --manifest .\project.json --output C:\Proyectos\mi-tienda
```

The destination must be outside this repository. The source checkout must be clean unless `--allow-dirty` is explicitly used for development. The command does not initialize Git.

Use `--no-start` to install, typecheck, and build without starting Docker or the applications. `--skip-install` exists only for composer tests and source inspection.

## Generated project

The project has local Medusa CLI dependencies, backend, storefront, operational seed, Site Manager, one template package, selected extension packages, isolated Docker names, ports and volumes, `mercatto.lock.json`, validation workflow, backend Dockerfile, and DigitalOcean App Spec example.

The normal start path launches PostgreSQL, Redis, and Typesense; runs migrations; creates the Admin user; applies the operational seed; starts the apps; and verifies backend `/health` plus the storefront home. The seed creates no demo products or import jobs.

## Site Manager

The generated Admin exposes identity, commerce preview/apply, branding, content, template settings, extension activation, configuration history, rollback, platform status, and platform change requests. Public storefront configuration is available at `GET /store/site-config`. Secrets remain environment variables.

## Platform

`apps/platform` is deployed separately from generated projects. Its API and durable PostgreSQL worker authenticate projects, inspect managed file hashes, fetch immutable component source, create a branch and pull request, and reconcile merged pull requests from signed GitHub webhooks. It never writes directly to `main`.

The component catalog currently contains 32 independently extracted extensions under `packages/extensions/<id>`. Each package has a physical payload plus `mercatto-component.json` with its version, dependencies, environment contract, settings namespace, migrations, managed files and hashes. Integration files such as workflows, jobs, subscribers and middleware registries are installed only with their owner extension. The demo creator is deliberately excluded from customer projects.

The current storefront templates resolve 23 extensions transitively because their shared commerce, B2B, content, search and personalization surfaces import them. The remaining extensions are not copied. Reducing that required set further means decoupling those shared storefront surfaces, not hiding copied code.

The backend reads the catalog at runtime (`GET /admin/platform/catalog`). Deployed backends and generated projects do not contain `packages/project-catalog`, so a committed mirror lives at `apps/backend/src/lib/platform/catalog.json`. After editing the canonical catalog, run `node packages/project-catalog/src/sync-backend-mirror.js` (the catalog validator fails if the mirror is stale).

After changing extension source, refresh and verify the packages with:

```powershell
corepack pnpm site:components:extract
corepack pnpm site:components:validate
```

`site:components:extract` is global: it rebuilds all extension payloads from the working tree, so a single-extension change ends up touching every package. To audit without rewriting anything, use `site:components:verify`, optionally scoped to the extensions you touched:

```powershell
corepack pnpm site:components:verify erp
```

The two checks are not interchangeable. `validate` compares the `managed_files` hashes against the raw payload bytes, so its result depends on the checkout: with `core.autocrlf=true` the working tree holds CRLF while the blob holds LF, and the same content hashes differently on Windows and Linux. On a Linux runner it would flag all 1938 `managed_files` as stale, so it stays a local byte-exact guard.

`verify` normalizes line endings before comparing, so it returns the same result on any checkout. It reports by category — `[payload]` the snapshot fell behind its canonical file (the check that matters most: a stale payload means the generated project starts on old code), `[hash]` stale `sha256`, `[identity]` catalog against manifest, `[package]` `package.json` against manifest, `[files]` missing or unlisted payload files, `[owner]` two extensions claiming the same target.

`.github/workflows/validate-catalog.yml` runs `site:catalog:validate` and `site:components:verify` on every pull request. Neither script uses external dependencies, so the job needs no `pnpm install` and finishes in seconds.

The composer removes all extension-owned source from the core snapshot and overlays only the transitive selection from the catalog. Medusa's module and middleware registries are generated from that selection, so absent extensions are not imported at build or runtime.

After a production build, `pnpm --filter @repo/backend start:local` starts the compiled backend using `apps/backend/.env`. DigitalOcean continues to use `start:no-migrate` with runtime secrets injected by the platform.

## DigitalOcean

Every generated project contains `.do/app.yaml.example` and `docs/deploy-digitalocean.md`. Resource creation and secret entry remain manual. The example deploys only the backend and runs migrations as a `PRE_DEPLOY` job; the storefront is configured on Vercel or another provider.

The generated example starts both the backend and migration job at `apps-s-2vcpu-4gb`. A local runtime validation exceeded 2 GB while loading the current 23-extension template, so the previous 2 GB example is not a safe baseline. Measure production usage before reducing or increasing the size.

### The backend npm lock

The `mercatto-backend` app builds `/workspace/apps/backend` with the Node buildpack, using **npm** — the root `pnpm-lock.yaml` is outside that directory and never seen. `apps/backend/package-lock.json` exists so the buildpack runs `npm ci` (deterministic, installs from the `resolved` tarball URLs) instead of `npm install` (re-resolves the whole graph against the registry on every build). The buildpack picks this up from the lockfile's presence; there is nothing to configure in the DigitalOcean AppSpec.

The distinction is not only about speed. `npm install` needs the full metadata document for every dependency, and on 2026-07-31 the registry served `429 Too Many Requests` (Cloudflare `error code: 1015`) for `@medusajs/admin-sdk`'s document specifically — reproducible from unrelated networks, while its version endpoint and tarball both answered `200`. Four consecutive deploys failed on it. `npm ci` never requests those documents, so a committed lock makes the build immune to that class of outage.

The cost is that `npm ci` **aborts** when the lock falls behind `package.json`, which would break the production deploy rather than warn. After editing `apps/backend/package.json`, regenerate the lock and let `pnpm backend:lock:verify` (also a step in `validate-catalog.yml`) confirm the two agree:

```powershell
cd apps/backend
npm install --package-lock-only
```

Keep `apps/backend/.npmrc` in place when regenerating: it sets `legacy-peer-deps=true`, without which npm refuses to resolve the tree at all.
