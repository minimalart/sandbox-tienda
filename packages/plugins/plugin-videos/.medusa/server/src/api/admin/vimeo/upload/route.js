"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const vimeo_video_1 = require("../../../../modules/vimeo-video");
const POST = async (req, res) => {
    const vimeoService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
    const { title, description, file_size } = req.validatedBody;
    const result = await vimeoService.initiateUpload(title, description, file_size);
    res.json(result);
};
exports.POST = POST;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3ZpbWVvL3VwbG9hZC9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSxpRUFBcUU7QUFJOUQsTUFBTSxJQUFJLEdBQUcsS0FBSyxFQUFFLEdBQTRDLEVBQUUsR0FBbUIsRUFBRSxFQUFFO0lBQzlGLE1BQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUEwQixnQ0FBa0IsQ0FBQyxDQUFDO0lBRXBGLE1BQU0sRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxhQUFhLENBQUM7SUFFNUQsTUFBTSxNQUFNLEdBQUcsTUFBTSxZQUFZLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFFaEYsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNuQixDQUFDLENBQUM7QUFSVyxRQUFBLElBQUksUUFRZiJ9