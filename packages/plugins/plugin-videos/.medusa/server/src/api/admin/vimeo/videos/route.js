"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const vimeo_video_1 = require("../../../../modules/vimeo-video");
const GET = async (req, res) => {
    const vimeoService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
    const { query, page = 1, per_page = 25 } = req.validatedQuery || {};
    const result = await vimeoService.searchVimeoVideos(query, page, per_page);
    res.json(result);
};
exports.GET = GET;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3ZpbWVvL3ZpZGVvcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSxpRUFBcUU7QUFJOUQsTUFBTSxHQUFHLEdBQUcsS0FBSyxFQUFFLEdBQTZDLEVBQUUsR0FBbUIsRUFBRSxFQUFFO0lBQzlGLE1BQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUEwQixnQ0FBa0IsQ0FBQyxDQUFDO0lBRXBGLE1BQU0sRUFBRSxLQUFLLEVBQUUsSUFBSSxHQUFHLENBQUMsRUFBRSxRQUFRLEdBQUcsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLGNBQWMsSUFBSSxFQUFFLENBQUM7SUFFcEUsTUFBTSxNQUFNLEdBQUcsTUFBTSxZQUFZLENBQUMsaUJBQWlCLENBQ2pELEtBQTJCLEVBQzNCLElBQWMsRUFDZCxRQUFrQixDQUNuQixDQUFDO0lBRUYsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNuQixDQUFDLENBQUM7QUFaVyxRQUFBLEdBQUcsT0FZZCJ9