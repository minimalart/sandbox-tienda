# Memory debug runbook (TEMPORARY)

Self-contained instrumentation to find the production OOM (heap grows to ~1GB
over ~50min of traffic, then `JavaScript heap out of memory`). **Everything is a
no-op unless `MEMORY_MONITOR=true`.** Delete this file + the diagnostic code once
the leak is found (see "Cleanup").

## 0. Free experiment first (no code, do it in parallel)

The only thing still living in the Node heap is the **in-memory workflow engine**
(each add-to-cart stores execution state there). Test it for free:

| Var | Value |
|-----|-------|
| `WORKFLOW_ENGINE_REDIS` | `true` |
| `NODE_OPTIONS` | `--max-old-space-size=1536` |

Redeploy and watch RAM for 1–2h. **If it stabilizes → the workflow engine was the
leak** and no snapshot is needed. If it keeps climbing, capture a snapshot (below).

## 1. Env vars to enable the diagnostics (DO dashboard → backend component)

| Var | Value | Purpose |
|-----|-------|---------|
| `NODE_OPTIONS` | `--max-old-space-size=1536` | Use the full 2GB instead of OOMing at ~1GB; makes the threshold predictable |
| `MEMORY_MONITOR` | `true` | Master switch (periodic memory log + per-request log + auto snapshot) |
| `MEMORY_MONITOR_THRESHOLD_MB` | `900` | Auto-capture a snapshot once heapUsed crosses this |
| `MEMORY_MONITOR_INTERVAL_MS` | `30000` | Memory log frequency |
| `DEBUG_HEAP_TOKEN` | `<long random secret>` | Enables + protects the on-demand route (unset = route 404s) |
| `MEMORY_SNAPSHOT_URL_TTL_S` | `86400` (optional) | Presigned download URL TTL (default 24h, max 7d) |
| `S3_*` | already set | Reused to upload the snapshot to Spaces |

⚠️ **Before enabling: widen the DO health check** `initial_delay_seconds`/timeout.
Capturing a snapshot is stop-the-world (freezes the event loop for seconds), so DO
could otherwise kill the container mid-dump.

## 2. Capture a snapshot

- **Automatic:** with `MEMORY_MONITOR=true`, when heapUsed crosses the threshold it
  captures once and logs a presigned download URL to the DO runtime logs.
- **On demand** (preferred — pick a calm moment so a restart can't interrupt it):
  ```bash
  curl -X POST https://<backend>/admin/debug/heap-snapshot \
    -H "x-debug-heap-token: $DEBUG_HEAP_TOKEN"
  # → { "key": "...", "sizeBytes": ..., "url": "https://...spaces...?X-Amz-..." }
  ```
  Capture **twice** (e.g. at ~600MB and ~900MB heap) — the DevTools Comparison view
  between two snapshots makes the leak obvious.

## 3. Download + analyze

- Open the presigned `url` in a browser (no Spaces folder access needed) → saves the
  `.heapsnapshot`.
- Chrome DevTools → **Memory** → **Load** → the file → **Summary**, sort by
  **Retained Size**; use the **Retainers** pane / **Comparison** between two snapshots
  to spot the growing constructor (usually one unbounded Map/array/cache).

## 4. Cleanup (after the leak is found)

Revert PR #287 — all changes are self-contained:
- `apps/backend/src/lib/heap-snapshot.ts` (delete)
- `apps/backend/src/api/admin/debug/heap-snapshot/route.ts` (delete)
- `apps/backend/instrumentation.ts` (remove `startMemoryMonitor()` + import)
- `apps/backend/src/api/middlewares.ts` (remove `memoryRequestLogger` + its route)
- `apps/backend/package.json` (drop the 3 `@aws-sdk/*` deps)
- this file
- Unset the env vars in DO.
