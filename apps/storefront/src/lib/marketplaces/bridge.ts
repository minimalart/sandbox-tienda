const PREFIX = '/marketplaces/mercadolibre'
const MAX_NOTIFICATION_BYTES = 64 * 1024
const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
}

export function isMarketplaceIngress(pathname: string): boolean {
  return pathname === `${PREFIX}/callback` || pathname === `${PREFIX}/notifications`
}

function backendTarget(request: Request, backend: string | undefined, path: string): URL | null {
  try {
    if (!backend) return null
    const target = new URL(backend)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
    if (target.protocol !== 'https:' && !(local && target.protocol === 'http:')) return null
    if (target.username || target.password || target.origin === new URL(request.url).origin) return null
    return new URL(`${PREFIX}/${path}`, target.origin)
  } catch {
    return null
  }
}

function response(status: number): Response {
  return new Response(null, { status, headers: PRIVATE_HEADERS })
}

// Redirect the browser so the backend's subsequent relative /app redirect keeps
// the admin origin. The OAuth exchange still uses the configured public callback.
export function redirectMarketplaceCallback(request: Request, backend: string | undefined): Response {
  const target = backendTarget(request, backend, 'callback')
  if (!target) return response(503)
  const query = new URL(request.url).searchParams
  for (const field of ['code', 'state', 'error', 'error_description']) {
    const values = query.getAll(field)
    if (values.length > 1) return response(400)
    if (values.length) target.searchParams.set(field, values[0])
  }
  return new Response(null, {
    status: 302,
    headers: { ...PRIVATE_HEADERS, Location: target.href },
  })
}

export async function forwardMarketplaceNotification(
  request: Request,
  backend: string | undefined,
  send: typeof fetch = fetch,
): Promise<Response> {
  const target = backendTarget(request, backend, 'notifications')
  if (!target) return response(503)
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return response(415)
  if (Number(request.headers.get('content-length')) > MAX_NOTIFICATION_BYTES) return response(413)

  const reader = request.body?.getReader()
  if (!reader) return response(400)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > MAX_NOTIFICATION_BYTES) {
        await reader.cancel()
        return response(413)
      }
      chunks.push(chunk.value)
    }
  } catch {
    return response(400)
  } finally {
    reader.releaseLock()
  }
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    const upstream = await send(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })
    // Do not acknowledge a failed persistence, expose backend details or follow
    // redirects. ML can retry a notification that was not durably received.
    await upstream.body?.cancel()
    return response(upstream.ok ? 200 : upstream.status >= 400 ? upstream.status : 502)
  } catch {
    return response(502)
  }
}
