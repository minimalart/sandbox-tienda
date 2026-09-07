"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const vimeo_video_1 = require("../../../../modules/vimeo-video");
const GET = async (req, res) => {
    const vimeoService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
    const status = await vimeoService.getConnectionStatus();
    res.json(status);
};
exports.GET = GET;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3ZpbWVvL3N0YXR1cy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSxpRUFBcUU7QUFHOUQsTUFBTSxHQUFHLEdBQUcsS0FBSyxFQUFFLEdBQWtCLEVBQUUsR0FBbUIsRUFBRSxFQUFFO0lBQ25FLE1BQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUEwQixnQ0FBa0IsQ0FBQyxDQUFDO0lBRXBGLE1BQU0sTUFBTSxHQUFHLE1BQU0sWUFBWSxDQUFDLG1CQUFtQixFQUFFLENBQUM7SUFFeEQsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNuQixDQUFDLENBQUM7QUFOVyxRQUFBLEdBQUcsT0FNZCJ9