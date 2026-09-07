/**
 * Memory diagnostics — heap snapshot capture + upload to DigitalOcean Spaces.
 *
 * Temporary, self-contained instrumentation to find a production OOM (the heap
 * grows to ~1GB over ~50min of traffic, then crashes). ALL of it is a no-op
 * unless `MEMORY_MONITOR=true`, so it costs nothing in normal operation. Delete
 * this file (and its three call sites) once the leak is found.
 *
 * Why the aws-sdk directly instead of Medusa's FILE module: `createFiles` takes
 * `content` as a base64 string, so a ~300MB snapshot would become a Buffer + a
 * base64 string ON the very heap we're trying to diagnose — defeating the point.
 * We stream the file from disk to Spaces so the bytes never land on the JS heap.
 */
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import v8 from 'node:v8';
import * as Sentry from '@sentry/node';

const MB = 1024 * 1024;

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

// Fallback when no Medusa logger is available (e.g. inside register() at boot).
const consoleLogger: Logger = {
  info: (m) => console.warn(`[memory-monitor] ${m}`),
  warn: (m) => console.warn(`[memory-monitor] ${m}`),
  error: (m) => console.error(`[memory-monitor] ${m}`),
};

/**
 * Serialize the V8 heap to an ephemeral file. STOP-THE-WORLD: the event loop is
 * frozen for the whole serialization (seconds for a ~1GB heap) — which is why we
 * trigger early (see startMemoryMonitor) and recommend widening the DO health
 * check before enabling.
 */
export function captureHeapSnapshot(): string {
  const file = path.join(os.tmpdir(), `heap-${process.pid}-${Date.now()}.heapsnapshot`);
  v8.writeHeapSnapshot(file);
  return file;
}

function buildS3Client(): S3Client {
  return new S3Client({
    // DigitalOcean Spaces is S3-compatible: point endpoint at the Spaces host.
    // Reuses the exact env vars the Medusa FILE module already uses for uploads.
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || process.env.S3_URL,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
    },
  });
}

/**
 * Stream a local snapshot file to Spaces via multipart upload (backpressured:
 * only a couple of ~8MB part buffers are ever resident, never the whole file).
 * The object stays PRIVATE — a heap snapshot contains live memory (tokens, PII).
 *
 * Returns a time-limited PRESIGNED download URL so the snapshot can be retrieved
 * without any Spaces console/folder access — just open the link in a browser.
 */
export async function uploadSnapshotToSpaces(
  localPath: string,
): Promise<{ key: string; size: number; url: string }> {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET not configured — cannot upload heap snapshot');
  }

  const prefix = process.env.S3_PREFIX ? `${process.env.S3_PREFIX.replace(/\/$/, '')}/` : '';
  const key = `${prefix}heap-snapshots/${path.basename(localPath)}`;
  const size = fs.statSync(localPath).size;
  const client = buildS3Client();

  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(localPath),
      ContentType: 'application/octet-stream',
      // Private by default on Spaces — do NOT make this public.
    },
    queueSize: 2,
    partSize: 8 * MB,
  });

  await upload.done();

  // Presigned GET URL: lets you download a PRIVATE object via a plain link with
  // no console/folder access. TTL configurable (default 24h, SigV4 max 7d).
  const expiresIn = Math.min(Number(process.env.MEMORY_SNAPSHOT_URL_TTL_S) || 86_400, 604_800);
  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn,
  });

  return { key, size, url };
}

/**
 * Capture → upload → delete the local temp file (always, /tmp is small and
 * ephemeral). Returns the uploaded object key + size.
 */
export async function captureAndUpload(
  logger: Logger = consoleLogger,
): Promise<{ key: string; size: number; url: string }> {
  let localPath: string | undefined;
  try {
    logger.warn('Capturing heap snapshot (event loop will pause)…');
    localPath = captureHeapSnapshot();
    const result = await uploadSnapshotToSpaces(localPath);
    logger.warn(`Heap snapshot uploaded: ${result.key} (${Math.round(result.size / MB)}MB)`);
    // Log the presigned download URL so it's retrievable straight from the DO
    // logs — no Spaces folder access needed.
    logger.warn(`Heap snapshot download URL (expires): ${result.url}`);
    if (Sentry.isInitialized()) {
      Sentry.captureMessage(`heap snapshot uploaded: ${result.key}`);
    }
    return result;
  } catch (err) {
    logger.error(`Heap snapshot failed: ${(err as Error).message}`);
    throw err;
  } finally {
    if (localPath) {
      await fs.promises.unlink(localPath).catch(() => {
        /* ephemeral disk, best-effort cleanup */
      });
    }
  }
}

let monitorStarted = false;
let snapshotCaptured = false;

/**
 * Periodic memory monitor. No-op unless MEMORY_MONITOR=true. Logs
 * process.memoryUsage() every MEMORY_MONITOR_INTERVAL_MS (default 30s) and, when
 * heapUsed first crosses MEMORY_MONITOR_THRESHOLD_MB (default 900MB), captures a
 * heap snapshot ONCE and uploads it — early enough (with --max-old-space-size
 * =1536) to leave headroom for serialization without causing the OOM itself.
 */
export function startMemoryMonitor(): void {
  if (process.env.MEMORY_MONITOR !== 'true' || monitorStarted) {
    return;
  }
  monitorStarted = true;

  const intervalMs = Number(process.env.MEMORY_MONITOR_INTERVAL_MS) || 30_000;
  const thresholdMb = Number(process.env.MEMORY_MONITOR_THRESHOLD_MB) || 900;

  consoleLogger.warn(
    `ON — interval ${intervalMs}ms, snapshot threshold ${thresholdMb}MB (S3_BUCKET ${process.env.S3_BUCKET ? 'set' : 'MISSING'})`,
  );

  const timer = setInterval(() => {
    const m = process.memoryUsage();
    const heapUsedMb = Math.round(m.heapUsed / MB);
    consoleLogger.info(
      `rss=${Math.round(m.rss / MB)}MB heapUsed=${heapUsedMb}MB heapTotal=${Math.round(
        m.heapTotal / MB,
      )}MB external=${Math.round(m.external / MB)}MB arrayBuffers=${Math.round(
        m.arrayBuffers / MB,
      )}MB`,
    );

    if (!snapshotCaptured && process.env.S3_BUCKET && heapUsedMb >= thresholdMb) {
      // Once per process: avoid repeating the stop-the-world pause (which would
      // only worsen an already-pressured heap).
      snapshotCaptured = true;
      consoleLogger.warn(
        `heapUsed ${heapUsedMb}MB crossed threshold ${thresholdMb}MB — capturing snapshot once`,
      );
      void captureAndUpload();
    }
  }, intervalMs);

  // Never keep the event loop alive on the monitor's account.
  timer.unref();
}
