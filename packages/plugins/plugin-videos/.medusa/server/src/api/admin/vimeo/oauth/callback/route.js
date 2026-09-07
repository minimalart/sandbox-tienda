"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const vimeo_video_1 = require("../../../../../modules/vimeo-video");
const settings_1 = require("../../../../../modules/vimeo-video/settings");
/**
 * Función y no `const` de módulo: el destino viene de `app-settings` (fila en
 * base > env > default) y un `const` lo congelaría con el env del arranque.
 */
const defaultRedirect = () => (0, settings_1.getVimeoSettings)().oauthRedirectSuccess;
const decodeState = (rawState) => {
    if (!rawState || typeof rawState !== 'string') {
        return {};
    }
    try {
        const buffer = Buffer.from(rawState, 'base64url');
        const parsed = JSON.parse(buffer.toString('utf-8'));
        return typeof parsed === 'object' && parsed ? parsed : {};
    }
    catch {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, 'Invalid OAuth state payload.');
    }
};
const GET = async (req, res) => {
    try {
        const { code, state, error, error_description } = req.validatedQuery ?? {};
        if (error) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Vimeo OAuth error: ${error_description ?? error}`);
        }
        if (!code) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, 'Missing authorization code.');
        }
        const vimeoService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
        await vimeoService.exchangeCodeForTokens(code);
        const statePayload = decodeState(state);
        const redirectUrl = statePayload.redirect_to ?? defaultRedirect();
        res.setHeader('Location', redirectUrl);
        return res.status(302).end();
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during OAuth callback';
        console.error('Vimeo OAuth Callback Error:', {
            message: errorMessage,
            error: err,
        });
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `OAuth callback failed: ${errorMessage}`);
    }
};
exports.GET = GET;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3ZpbWVvL29hdXRoL2NhbGxiYWNrL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLHFEQUF3RDtBQUN4RCxvRUFBd0U7QUFFeEUsMEVBQStFO0FBRy9FOzs7R0FHRztBQUNILE1BQU0sZUFBZSxHQUFHLEdBQVcsRUFBRSxDQUFDLElBQUEsMkJBQWdCLEdBQUUsQ0FBQyxvQkFBb0IsQ0FBQztBQUU5RSxNQUFNLFdBQVcsR0FBRyxDQUFDLFFBQW1DLEVBQTRCLEVBQUU7SUFDcEYsSUFBSSxDQUFDLFFBQVEsSUFBSSxPQUFPLFFBQVEsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUM5QyxPQUFPLEVBQUUsQ0FBQztJQUNaLENBQUM7SUFFRCxJQUFJLENBQUM7UUFDSCxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUNsRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNwRCxPQUFPLE9BQU8sTUFBTSxLQUFLLFFBQVEsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0lBQzVELENBQUM7SUFBQyxNQUFNLENBQUM7UUFDUCxNQUFNLElBQUksbUJBQVcsQ0FBQyxtQkFBVyxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQUUsOEJBQThCLENBQUMsQ0FBQztJQUN4RixDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBRUssTUFBTSxHQUFHLEdBQUcsS0FBSyxFQUN0QixHQUFvRCxFQUNwRCxHQUFtQixFQUNuQixFQUFFO0lBQ0YsSUFBSSxDQUFDO1FBQ0gsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixFQUFFLEdBQUcsR0FBRyxDQUFDLGNBQWMsSUFBSSxFQUFFLENBQUM7UUFFM0UsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNWLE1BQU0sSUFBSSxtQkFBVyxDQUNuQixtQkFBVyxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQzlCLHNCQUFzQixpQkFBaUIsSUFBSSxLQUFLLEVBQUUsQ0FDbkQsQ0FBQztRQUNKLENBQUM7UUFFRCxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDVixNQUFNLElBQUksbUJBQVcsQ0FBQyxtQkFBVyxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQUUsNkJBQTZCLENBQUMsQ0FBQztRQUN2RixDQUFDO1FBRUQsTUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQTBCLGdDQUFrQixDQUFDLENBQUM7UUFFcEYsTUFBTSxZQUFZLENBQUMscUJBQXFCLENBQUMsSUFBYyxDQUFDLENBQUM7UUFFekQsTUFBTSxZQUFZLEdBQUcsV0FBVyxDQUFDLEtBQTJCLENBQUMsQ0FBQztRQUM5RCxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsV0FBVyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBRWxFLEdBQUcsQ0FBQyxTQUFTLENBQUMsVUFBVSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ3ZDLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUMvQixDQUFDO0lBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUNiLE1BQU0sWUFBWSxHQUNoQixHQUFHLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxxQ0FBcUMsQ0FBQztRQUU3RSxPQUFPLENBQUMsS0FBSyxDQUFDLDZCQUE2QixFQUFFO1lBQzNDLE9BQU8sRUFBRSxZQUFZO1lBQ3JCLEtBQUssRUFBRSxHQUFHO1NBQ1gsQ0FBQyxDQUFDO1FBRUgsTUFBTSxJQUFJLG1CQUFXLENBQ25CLG1CQUFXLENBQUMsS0FBSyxDQUFDLFlBQVksRUFDOUIsMEJBQTBCLFlBQVksRUFBRSxDQUN6QyxDQUFDO0lBQ0osQ0FBQztBQUNILENBQUMsQ0FBQztBQXpDVyxRQUFBLEdBQUcsT0F5Q2QifQ==