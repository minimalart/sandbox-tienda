// Shared preview UI. Canonical: apps/backend/src/admin/lib/puck/storefront-preview.tsx.
// Plugin copy is checked by the preview parity test; it has no host imports.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Drawer, Label, Select, Text } from '@medusajs/ui';
import type { Config, Data } from '@measured/puck';

type PreviewRequest = <T>(url: string, init?: RequestInit) => Promise<T>;
type Translate = (key: string) => string;
type Site = { id: string; name: string; slug: string };
type Context = {
  request: PreviewRequest; endpoint: string; previewPath: string; storefront: string; site: string; country: string; language: 'es' | 'en'; t: Translate; refresh: number;
};
const PreviewContext = createContext<Context | null>(null);

// Long homes can mount a dozen frames at once. Hydrate one at a time so they
// reuse the loaded storefront assets instead of competing for the same cache
// entries (especially large development bundles). Edits/unmounts cancel a slot.
let loadingFrame = false;
const pendingFrames: Array<() => void> = [];
function acquireFrame(signal: AbortSignal): Promise<() => void> {
  return new Promise(resolve => {
    const start = () => {
      if (signal.aborted) { resolve(() => {}); return; }
      loadingFrame = true;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        signal.removeEventListener('abort', release);
        loadingFrame = false;
        pendingFrames.shift()?.();
      };
      signal.removeEventListener('abort', cancel);
      signal.addEventListener('abort', release, { once: true });
      resolve(release);
    };
    const cancel = () => {
      const index = pendingFrames.indexOf(start);
      if (index >= 0) pendingFrames.splice(index, 1);
      resolve(() => {});
    };
    signal.addEventListener('abort', cancel, { once: true });
    if (loadingFrame) pendingFrames.push(start); else start();
  });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) throw new Error(`Preview request failed (${response.status})`);
  return response.json();
}

function PreviewFrame({ data, mode = 'block', title }: { data: Data; mode?: 'block' | 'page'; title: string }) {
  const context = useContext(PreviewContext)!;
  const frame = useRef<HTMLIFrameElement>(null);
  const revision = useRef(0);
  const releaseFrame = useRef<() => void>(() => {});
  const [snapshot, setSnapshot] = useState<{ token: string; url: string; revision: number } | null>(null);
  const [height, setHeight] = useState(240);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const serialized = JSON.stringify(data);
  const { request, endpoint, previewPath, storefront, site, country, language, refresh, t } = context;
  useEffect(() => {
    if (!site || !country) return;
    const controller = new AbortController();
    const currentRevision = ++revision.current;
    setError(false);
    setReady(false);
    const timer = window.setTimeout(async () => {
      const release = await acquireFrame(controller.signal);
      if (controller.signal.aborted) { release(); return; }
      releaseFrame.current = release;
      void request<{ token: string }>(endpoint, {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({ puck_data: JSON.parse(serialized), site_id: site, country_code: country, parent_origin: window.location.origin, language, mode }),
      }).then(({ token }) => {
        if (!controller.signal.aborted) setSnapshot({ token, url: new URL(`${previewPath}/${token}`, storefront).href, revision: currentRevision });
      }).catch(() => { release(); if (!controller.signal.aborted) setError(true); });
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [serialized, request, endpoint, previewPath, storefront, site, country, language, mode, retry, refresh]);
  useEffect(() => {
    if (!snapshot) return;
    const timeout = window.setTimeout(() => {
      if (snapshot.revision !== revision.current) return;
      releaseFrame.current(); setError(true);
    }, 45_000);
    const listener = (event: MessageEvent) => {
      if (snapshot.revision !== revision.current || event.origin !== new URL(snapshot.url).origin || event.source !== frame.current?.contentWindow ||
        event.data?.type !== 'mercatto:preview-size' || event.data?.token !== snapshot.token) return;
      const value = event.data.height;
      if (!Number.isFinite(value) || value < 0 || value > 100_000) return;
      setHeight(Math.max(1, value)); setReady(true); setError(false); window.clearTimeout(timeout); releaseFrame.current();
    };
    window.addEventListener('message', listener);
    return () => { window.clearTimeout(timeout); window.removeEventListener('message', listener); };
  }, [snapshot]);
  return <div style={{ position: 'relative', width: '100%', minHeight: error || !snapshot ? 96 : undefined }} aria-busy={!ready && !error}>
    {snapshot && <iframe ref={frame} src={snapshot.url} title={title} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin"
      tabIndex={mode === 'block' ? -1 : 0}
      style={{ display: 'block', width: '100%', height: mode === 'page' ? '70vh' : height, border: 0, pointerEvents: mode === 'block' ? 'none' : 'auto', opacity: ready ? 1 : 0.45 }} />}
    {(!ready || error) && <div className="bg-ui-bg-base text-ui-fg-subtle p-3 text-sm" style={{ position: snapshot ? 'absolute' : 'relative', inset: snapshot ? '0 0 auto 0' : undefined }}>
      {error ? <><Text>{t('PREVIEW_ERROR')}</Text><Button variant="secondary" size="small" onClick={() => setRetry(value => value + 1)}>{t('PREVIEW_RETRY')}</Button></> : t('PREVIEW_LOADING')}
    </div>}
    {ready && mode === 'block' && height <= 1 && <Text className="text-ui-fg-subtle p-3">{t('PREVIEW_EMPTY_BLOCK')}</Text>}
  </div>;
}

/** Renderers stay stable across field edits: retain Puck selection/history. */
export function withStorefrontPreview(config: Config): Config {
  return { ...config, components: Object.fromEntries(Object.entries(config.components).map(([type, component]) => [type, {
    ...component,
    render: (props: any) => {
      const { puck: _puck, ...content } = props;
      return <PreviewFrame data={{ root: { props: {} }, content: [{ type, props: content }] } as Data} title={component.label || type} />;
    },
  }])) };
}

export function StorefrontPreviewProvider({ request: transport = request, endpoint, previewPath = '/_puck', storefront, language, t, liveData, children }: {
  request?: PreviewRequest; endpoint: string; previewPath?: string; storefront: string; language: string; t: Translate;
  liveData: { current: Data | null }; children: ReactNode;
}) {
  const [sites, setSites] = useState<Site[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [site, setSite] = useState('');
  const [country, setCountry] = useState('');
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const [pageData, setPageData] = useState<Data>({ content: [], root: { props: {} } } as Data);
  const [width, setWidth] = useState('1440');
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    void transport<{ sites: Site[]; countries: string[] }>(endpoint, { signal: controller.signal })
      .then(result => {
        setSites(result.sites); setCountries(result.countries);
        setSite(current => result.sites.some(value => value.id === current) ? current : result.sites[0]?.id || '');
        setCountry(current => result.countries.includes(current) ? current : result.countries[0] || '');
      }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [transport, endpoint, refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => setRefresh(value => value + 1), 8 * 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => { if (liveData.current) setPageData(liveData.current); }, 500);
    return () => window.clearInterval(timer);
  }, [open, liveData]);
  const context = useMemo<Context>(() => ({ request: transport, endpoint, previewPath, storefront, site, country, language: language.startsWith('en') ? 'en' : 'es', t, refresh }), [transport, endpoint, previewPath, storefront, site, country, language, t, refresh]);
  return <PreviewContext.Provider value={context}>
    <div className="flex flex-wrap items-center gap-3 border-b border-ui-border-base bg-ui-bg-base px-4 py-2">
      <Label>{t('PREVIEW_SITE')}</Label>
      {sites.length > 0 && <Select value={site} onValueChange={setSite}><Select.Trigger className="w-52"><Select.Value /></Select.Trigger><Select.Content>{sites.map(option => <Select.Item key={option.id} value={option.id}>{option.id === 'main' ? t('PREVIEW_MAIN') : option.name}</Select.Item>)}</Select.Content></Select>}
      {countries.length > 0 && <Select value={country} onValueChange={setCountry}><Select.Trigger className="w-24" aria-label={t('PREVIEW_COUNTRY')}><Select.Value /></Select.Trigger><Select.Content>{countries.map(value => <Select.Item key={value} value={value}>{value.toUpperCase()}</Select.Item>)}</Select.Content></Select>}
      <Button size="small" variant="secondary" onClick={() => setRefresh(value => value + 1)}>{t('PREVIEW_REFRESH')}</Button>
      <Button size="small" disabled={!site || !country} onClick={() => { if (liveData.current) setPageData(liveData.current); setOpen(true); }}>{t('PREVIEW_UNSAVED')}</Button>
      <Text size="small" className="text-ui-fg-subtle">{failed ? t('PREVIEW_ERROR') : !site || !country ? t('PREVIEW_CONTEXT_REQUIRED') : t('PREVIEW_HELP')}</Text>
    </div>
    {site && country ? children : null}
    <Drawer open={open} onOpenChange={setOpen}><Drawer.Content className="!max-w-[96vw] !w-[1600px]">
      <Drawer.Header><Drawer.Title>{t('PREVIEW_UNSAVED')}</Drawer.Title></Drawer.Header>
      <Drawer.Body className="overflow-auto">
        <div className="mb-3 flex items-center gap-3"><Label>{t('PREVIEW_WIDTH')}</Label><Select value={width} onValueChange={setWidth}><Select.Trigger className="w-32"><Select.Value /></Select.Trigger><Select.Content>{['390', '768', '1440'].map(value => <Select.Item key={value} value={value}>{value} px</Select.Item>)}</Select.Content></Select></div>
        <div style={{ width: Number(width), margin: '0 auto' }}><PreviewFrame data={pageData} mode="page" title={t('PREVIEW_UNSAVED')} /></div>
      </Drawer.Body><Drawer.Footer><Button variant="secondary" onClick={() => setOpen(false)}>{t('CANCEL')}</Button></Drawer.Footer>
    </Drawer.Content></Drawer>
  </PreviewContext.Provider>;
}
