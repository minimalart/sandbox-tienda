# Mercatto Platform

Central service for authenticated project registration and durable extension change requests. It uses a GitHub App installation token, creates a branch and pull request, and never updates `main` directly.

Required environment variables: `DATABASE_URL`, `PLATFORM_ADMIN_TOKEN`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `MERCATTO_SOURCE_OWNER`, and `MERCATTO_SOURCE_REPO`. For a private source repository, set `MERCATTO_SOURCE_TOKEN` or install the GitHub App on that repository too.

Run `pnpm --filter @repo/platform migrate`, then run the API and worker as separate processes.
