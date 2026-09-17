import { NextRequest, NextResponse } from 'next/server';
import { listSitesHubPage } from '@lib/site-config/list-sites';

export async function GET(request: NextRequest) {
  const offset = Number(request.nextUrl.searchParams.get('offset') ?? 0);
  const query = (request.nextUrl.searchParams.get('q') ?? '').slice(0, 200);
  if (!Number.isSafeInteger(offset) || offset < 0)
    return NextResponse.json({ error: 'Offset inválido' }, { status: 400 });
  try {
    return NextResponse.json(await listSitesHubPage(offset, query), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'No pudimos cargar las tiendas.' }, { status: 503 });
  }
}
