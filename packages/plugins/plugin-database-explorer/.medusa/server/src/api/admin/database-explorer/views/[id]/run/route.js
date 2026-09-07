"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const utils_1 = require("../../../utils");
async function GET(req, res) {
    try {
        const result = await (0, utils_1.databaseExplorerService)(req).runSavedView(String(req.params.id), {
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
        const message = error instanceof Error ? error.message : 'Error running saved view';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2RhdGFiYXNlLWV4cGxvcmVyL3ZpZXdzL1tpZF0vcnVuL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBR0Esa0JBbUJDO0FBckJELDBDQUE2RjtBQUV0RixLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsSUFBSSxDQUFDO1FBQ0gsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLCtCQUF1QixFQUFDLEdBQUcsQ0FBQyxDQUFDLFlBQVksQ0FDNUQsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQ3JCO1lBQ0UsS0FBSyxFQUFFLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztZQUNuQyxNQUFNLEVBQUUsSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO1lBQ3JDLElBQUksRUFBRSxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDakMsU0FBUyxFQUFFLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQztZQUMzQyxDQUFDLEVBQUUsSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQzNCLE9BQU8sRUFBRSxJQUFBLG9CQUFZLEVBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUM7U0FDekMsRUFDRCxJQUFBLGVBQU8sRUFBQyxHQUFHLENBQUMsQ0FDYixDQUFDO1FBQ0YsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sT0FBTyxHQUFHLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLDBCQUEwQixDQUFDO1FBQ3BGLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7QUFDSCxDQUFDIn0=