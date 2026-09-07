// ESLint flat config for the Medusa backend.
//
// Adopts the official @medusajs/eslint-plugin "recommended" preset, which
// enforces Medusa framework conventions across workflows, API routes, modules,
// subscribers, jobs, admin extensions and module links. It ships its own
// TypeScript parser and ignore rules, so this is intentionally zero-extra-config.
//
// Runs via `medusa lint`, and automatically inside `medusa build` /
// `medusa develop` (unless the `--no-lint` flag is passed).
const medusa = require("@medusajs/eslint-plugin");

module.exports = [
  // `public/` is this repo's copy of the compiled admin bundle (the build
  // script cpSync's dist/public -> public: ~30k minified JS files, ~1GB). The
  // Medusa preset ignores dist/.medusa but not public/, and linting it hangs
  // `medusa build`/`medusa lint` for an hour+. Must stay FIRST in the array.
  { ignores: ["public/**"] },

  ...medusa.configs.recommended,

  // Three recommended rules are downgraded from `error` to `warn` here because
  // in this codebase they fire on pre-existing, working patterns rather than
  // real defects. They stay visible as warnings (not silenced) for future
  // cleanup, but they don't block `medusa build` / deploy:
  //
  // - link-no-cross-module-relationship: our brand / points / wishlist /
  //   shop-by-look / demo-store / vimeo models use intra-module hasMany /
  //   belongsTo between two models in the SAME module dir (which the rule can't
  //   confirm statically), plus a couple of manual link tables (product↔brand,
  //   product↔video). Migrating those to `defineLink` is a schema + data move
  //   that must run as its own migration-tested change, not inside a version bump.
  // - service-methods-must-be-async: flags pure synchronous helper methods
  //   (e.g. generateHandle, buildGa4Params, resolveClientId) where `async` would
  //   only add overhead and force an `await` on every caller.
  // - step-must-return-step-response: false-positives when a step returns via a
  //   local helper (e.g. `return noop(reason)`) that itself returns a StepResponse.
  {
    rules: {
      "@medusajs/link-no-cross-module-relationship": "warn",
      "@medusajs/service-methods-must-be-async": "warn",
      "@medusajs/step-must-return-step-response": "warn",
    },
  },
];
