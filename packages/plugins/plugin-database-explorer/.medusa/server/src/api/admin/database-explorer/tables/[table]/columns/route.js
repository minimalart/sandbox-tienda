"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const utils_1 = require("../../../utils");
async function GET(req, res) {
    try {
        const service = (0, utils_1.databaseExplorerService)(req);
        const table = await service.retrieveDefinition(String(req.params.table), true);
        await service.audit({
            user_id: (0, utils_1.actorId)(req),
            action: 'list_columns',
            table_name: table.table_name,
            success: true,
        });
        return res.status(200).json({ table, columns: table.columns });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error loading columns';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2RhdGFiYXNlLWV4cGxvcmVyL3RhYmxlcy9bdGFibGVdL2NvbHVtbnMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQSxrQkFlQztBQWpCRCwwQ0FBa0U7QUFFM0QsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELElBQUksQ0FBQztRQUNILE1BQU0sT0FBTyxHQUFHLElBQUEsK0JBQXVCLEVBQUMsR0FBRyxDQUFDLENBQUM7UUFDN0MsTUFBTSxLQUFLLEdBQUcsTUFBTSxPQUFPLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDL0UsTUFBTSxPQUFPLENBQUMsS0FBSyxDQUFDO1lBQ2xCLE9BQU8sRUFBRSxJQUFBLGVBQU8sRUFBQyxHQUFHLENBQUM7WUFDckIsTUFBTSxFQUFFLGNBQWM7WUFDdEIsVUFBVSxFQUFFLEtBQUssQ0FBQyxVQUFVO1lBQzVCLE9BQU8sRUFBRSxJQUFJO1NBQ2QsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDakUsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixNQUFNLE9BQU8sR0FBRyxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQztRQUNqRixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUMzQyxDQUFDO0FBQ0gsQ0FBQyJ9