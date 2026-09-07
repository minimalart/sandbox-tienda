"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const utils_1 = require("../utils");
async function GET(req, res) {
    try {
        const relations = await (0, utils_1.databaseExplorerService)(req).listRelations();
        return res.status(200).json({ relations });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error loading relations';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2RhdGFiYXNlLWV4cGxvcmVyL3JlbGF0aW9ucy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUdBLGtCQVFDO0FBVkQsb0NBQW1EO0FBRTVDLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCxJQUFJLENBQUM7UUFDSCxNQUFNLFNBQVMsR0FBRyxNQUFNLElBQUEsK0JBQXVCLEVBQUMsR0FBRyxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDckUsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixNQUFNLE9BQU8sR0FBRyxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQztRQUNuRixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUMzQyxDQUFDO0FBQ0gsQ0FBQyJ9