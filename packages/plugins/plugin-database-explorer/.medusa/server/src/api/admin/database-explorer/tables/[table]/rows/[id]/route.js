"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const utils_1 = require("../../../../utils");
async function GET(req, res) {
    try {
        const service = (0, utils_1.databaseExplorerService)(req);
        const result = await service.getRow(String(req.params.table), String(req.params.id), (0, utils_1.actorId)(req));
        return res.status(200).json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error loading row';
        return res.status(404).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2RhdGFiYXNlLWV4cGxvcmVyL3RhYmxlcy9bdGFibGVdL3Jvd3MvW2lkXS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUdBLGtCQWFDO0FBZkQsNkNBQXFFO0FBRTlELEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCxJQUFJLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FBRyxJQUFBLCtCQUF1QixFQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzdDLE1BQU0sTUFBTSxHQUFHLE1BQU0sT0FBTyxDQUFDLE1BQU0sQ0FDakMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQ3hCLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUNyQixJQUFBLGVBQU8sRUFBQyxHQUFHLENBQUMsQ0FDYixDQUFDO1FBQ0YsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sT0FBTyxHQUFHLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDO1FBQzdFLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7QUFDSCxDQUFDIn0=