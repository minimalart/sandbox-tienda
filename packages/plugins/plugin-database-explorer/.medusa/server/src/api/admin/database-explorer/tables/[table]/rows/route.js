"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const utils_1 = require("../../../utils");
async function GET(req, res) {
    try {
        const service = (0, utils_1.databaseExplorerService)(req);
        const result = await service.getRows(String(req.params.table), {
            limit: (0, utils_1.queryString)(req.query.limit),
            offset: (0, utils_1.queryString)(req.query.offset),
            sort: (0, utils_1.queryString)(req.query.sort),
            direction: (0, utils_1.queryString)(req.query.direction),
            q: (0, utils_1.queryString)(req.query.q),
            filters: (0, utils_1.parseFilters)(req.query.filters),
        }, (0, utils_1.actorId)(req));
        return res.status(200).json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error loading rows';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2RhdGFiYXNlLWV4cGxvcmVyL3RhYmxlcy9bdGFibGVdL3Jvd3Mvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQSxrQkFvQkM7QUF0QkQsMENBQTZGO0FBRXRGLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCxJQUFJLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FBRyxJQUFBLCtCQUF1QixFQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzdDLE1BQU0sTUFBTSxHQUFHLE1BQU0sT0FBTyxDQUFDLE9BQU8sQ0FDbEMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQ3hCO1lBQ0UsS0FBSyxFQUFFLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztZQUNuQyxNQUFNLEVBQUUsSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO1lBQ3JDLElBQUksRUFBRSxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDakMsU0FBUyxFQUFFLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQztZQUMzQyxDQUFDLEVBQUUsSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQzNCLE9BQU8sRUFBRSxJQUFBLG9CQUFZLEVBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUM7U0FDekMsRUFDRCxJQUFBLGVBQU8sRUFBQyxHQUFHLENBQUMsQ0FDYixDQUFDO1FBQ0YsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sT0FBTyxHQUFHLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDO1FBQzlFLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7QUFDSCxDQUFDIn0=