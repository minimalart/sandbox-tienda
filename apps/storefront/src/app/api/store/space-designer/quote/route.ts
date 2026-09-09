import { NextRequest, NextResponse } from 'next/server';
import { getMedusaSDK } from '@lib/config';
import { getAuthHeaders } from '@lib/data/cookies';

/**
 * Quote requests never touch the cart. The plugin re-validates the design
 * against the published configurator and stores the contact data.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Solicitud inválida.' }, { status: 400 });
  }
  if (
    !body ||
    typeof body.configurator_id !== 'string' ||
    typeof body.name !== 'string' ||
    typeof body.email !== 'string' ||
    !body.snapshot ||
    typeof body.snapshot !== 'object'
  ) {
    return NextResponse.json({ message: 'Faltan datos de la consulta.' }, { status: 400 });
  }
  try {
    const sdk = await getMedusaSDK();
    const result = await sdk.client.fetch<{ requested: boolean }>(
      '/store/space-designer/quotes',
      {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: {
          configurator_id: body.configurator_id,
          template_id: typeof body.template_id === 'string' ? body.template_id : undefined,
          snapshot: body.snapshot,
          name: body.name,
          email: body.email,
          phone: typeof body.phone === 'string' ? body.phone : undefined,
          message: typeof body.message === 'string' ? body.message : undefined,
        },
      }
    );
    return NextResponse.json(result);
  } catch (error) {
    const status = (error as { status?: number })?.status;
    return NextResponse.json(
      {
        message:
          status && status < 500
            ? (error as Error).message
            : 'No pudimos enviar tu consulta. Intentá de nuevo.',
      },
      { status: status && status >= 400 && status < 500 ? status : 502 }
    );
  }
}
