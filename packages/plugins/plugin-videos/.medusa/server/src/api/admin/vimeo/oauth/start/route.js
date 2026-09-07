"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const vimeo_video_1 = require("../../../../../modules/vimeo-video");
const GET = async (req, res) => {
    const vimeoService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
    const { redirect_to } = req.validatedQuery || {};
    const state = redirect_to
        ? Buffer.from(JSON.stringify({ redirect_to })).toString('base64url')
        : undefined;
    const authUrl = await vimeoService.getAuthorizationUrl(state);
    res.json({ url: authUrl });
};
exports.GET = GET;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3ZpbWVvL29hdXRoL3N0YXJ0L3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLG9FQUF3RTtBQUlqRSxNQUFNLEdBQUcsR0FBRyxLQUFLLEVBQ3RCLEdBQWlELEVBQ2pELEdBQW1CLEVBQ25CLEVBQUU7SUFDRixNQUFNLFlBQVksR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBMEIsZ0NBQWtCLENBQUMsQ0FBQztJQUVwRixNQUFNLEVBQUUsV0FBVyxFQUFFLEdBQUcsR0FBRyxDQUFDLGNBQWMsSUFBSSxFQUFFLENBQUM7SUFFakQsTUFBTSxLQUFLLEdBQUcsV0FBVztRQUN2QixDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUM7UUFDcEUsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUVkLE1BQU0sT0FBTyxHQUFHLE1BQU0sWUFBWSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRTlELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztBQUM3QixDQUFDLENBQUM7QUFmVyxRQUFBLEdBQUcsT0FlZCJ9