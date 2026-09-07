/**
 * Inlined admin client. In the extension we imported `sdk` from
 * `apps/backend/src/admin/lib/client` — that host path is not reachable from a
 * published plugin. Same pattern as `plugin-ga4`: expose a thin `sdk.client.fetch`
 * shim over the browser `fetch` global with cookie-based credentials (the admin
 * runs on the same origin as the backend, so no CORS/token juggling needed).
 *
 * We also expose a very small `sdk.admin.upload.create` compatibility shim used
 * by the edit-video drawer to upload a poster image.
 */

export class FetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'FetchError';
  }
}

type FetchOpts = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

async function adminFetch<T = unknown>(url: string, opts: FetchOpts = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new FetchError(`${res.status} ${res.statusText}`, res.status);
  }
  return res.json() as Promise<T>;
}

type UploadResult = { files?: Array<{ url: string }> };

async function uploadFiles(input: { files: File[] }): Promise<UploadResult> {
  const form = new FormData();
  for (const file of input.files) {
    form.append('files', file);
  }
  const res = await fetch('/admin/uploads', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) {
    throw new FetchError(`${res.status} ${res.statusText}`, res.status);
  }
  return (await res.json()) as UploadResult;
}

export const sdk = {
  client: {
    fetch: adminFetch,
  },
  admin: {
    upload: {
      create: uploadFiles,
    },
  },
};
