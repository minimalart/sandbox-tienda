# Mercatto monorepo core blueprint

`@repo/project-composer` currently materializes the core from the clean boilerplate commit
and removes generator/platform tooling. Components move behind their catalog manifests as
they reach `ready`; `embedded` entries remain part of the legacy source snapshot and cannot
be installed or upgraded independently yet.
