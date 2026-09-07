"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const vimeo_video_1 = require("../../../../../modules/vimeo-video");
const POST = async (req, res) => {
    const vimeoVideoModuleService = req.scope.resolve(vimeo_video_1.VIMEO_VIDEO_MODULE);
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ message: 'Video ID is required' });
        return;
    }
    try {
        const video = await vimeoVideoModuleService.syncVideoFromVimeo(id);
        res.json({ video });
    }
    catch (error) {
        console.error('[API] Error syncing video:', error);
        res.status(500).json({
            message: 'Failed to sync video from Vimeo',
            error: error.message,
        });
    }
};
exports.POST = POST;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL3ZpZGVvcy9baWRdL3N5bmMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0Esb0VBQXdFO0FBR2pFLE1BQU0sSUFBSSxHQUFHLEtBQUssRUFBRSxHQUFrQixFQUFFLEdBQW1CLEVBQUUsRUFBRTtJQUNwRSxNQUFNLHVCQUF1QixHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUEwQixnQ0FBa0IsQ0FBQyxDQUFDO0lBQy9GLE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO0lBRTFCLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUNSLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLHNCQUFzQixFQUFFLENBQUMsQ0FBQztRQUMxRCxPQUFPO0lBQ1QsQ0FBQztJQUVELElBQUksQ0FBQztRQUNILE1BQU0sS0FBSyxHQUFHLE1BQU0sdUJBQXVCLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbkUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDdEIsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLDRCQUE0QixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ25ELEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ25CLE9BQU8sRUFBRSxpQ0FBaUM7WUFDMUMsS0FBSyxFQUFHLEtBQWEsQ0FBQyxPQUFPO1NBQzlCLENBQUMsQ0FBQztJQUNMLENBQUM7QUFDSCxDQUFDLENBQUM7QUFuQlcsUUFBQSxJQUFJLFFBbUJmIn0=