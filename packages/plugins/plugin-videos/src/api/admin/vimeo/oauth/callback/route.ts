import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { VIMEO_VIDEO_MODULE } from '../../../../../modules/vimeo-video';
import VimeoVideoModuleService from '../../../../../modules/vimeo-video/service';
import { getVimeoSettings } from '../../../../../modules/vimeo-video/settings';
import { AdminVimeoOAuthCallbackQueryType } from '../../validators';

/**
 * Función y no `const` de módulo: el destino viene de `app-settings` (fila en
 * base > env > default) y un `const` lo congelaría con el env del arranque.
 */
const defaultRedirect = (): string => getVimeoSettings().oauthRedirectSuccess;

const decodeState = (rawState: string | null | undefined): { redirect_to?: string } => {
  if (!rawState || typeof rawState !== 'string') {
    return {};
  }

  try {
    const buffer = Buffer.from(rawState, 'base64url');
    const parsed = JSON.parse(buffer.toString('utf-8'));
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Invalid OAuth state payload.');
  }
};

export const GET = async (
  req: MedusaRequest<AdminVimeoOAuthCallbackQueryType>,
  res: MedusaResponse
) => {
  try {
    const { code, state, error, error_description } = req.validatedQuery ?? {};

    if (error) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Vimeo OAuth error: ${error_description ?? error}`
      );
    }

    if (!code) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Missing authorization code.');
    }

    const vimeoService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);

    await vimeoService.exchangeCodeForTokens(code as string);

    const statePayload = decodeState(state as string | undefined);
    const redirectUrl = statePayload.redirect_to ?? defaultRedirect();

    res.setHeader('Location', redirectUrl);
    return res.status(302).end();
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error during OAuth callback';

    console.error('Vimeo OAuth Callback Error:', {
      message: errorMessage,
      error: err,
    });

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `OAuth callback failed: ${errorMessage}`
    );
  }
};
