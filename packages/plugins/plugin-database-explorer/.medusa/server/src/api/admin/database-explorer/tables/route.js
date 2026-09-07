"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const utils_1 = require("../utils");
async function GET(req, res) {
    try {
        const service = (0, utils_1.databaseExplorerService)(req);
        const includeDisabled = req.query.include_disabled === 'true';
        const tables = await service.listTables(includeDisabled);
        await service.audit({
            user_id: (0, utils_1.actorId)(req),
            action: 'list_tables',
            success: true,
        });
        return res.status(200).json({ tables });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error loading tables';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2RhdGFiYXNlLWV4cGxvcmVyL3RhYmxlcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUdBLGtCQWVDO0FBakJELG9DQUE0RDtBQUVyRCxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsSUFBSSxDQUFDO1FBQ0gsTUFBTSxPQUFPLEdBQUcsSUFBQSwrQkFBdUIsRUFBQyxHQUFHLENBQUMsQ0FBQztRQUM3QyxNQUFNLGVBQWUsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLGdCQUFnQixLQUFLLE1BQU0sQ0FBQztRQUM5RCxNQUFNLE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDekQsTUFBTSxPQUFPLENBQUMsS0FBSyxDQUFDO1lBQ2xCLE9BQU8sRUFBRSxJQUFBLGVBQU8sRUFBQyxHQUFHLENBQUM7WUFDckIsTUFBTSxFQUFFLGFBQWE7WUFDckIsT0FBTyxFQUFFLElBQUk7U0FDZCxDQUFDLENBQUM7UUFDSCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sT0FBTyxHQUFHLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixDQUFDO1FBQ2hGLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7QUFDSCxDQUFDIn0=