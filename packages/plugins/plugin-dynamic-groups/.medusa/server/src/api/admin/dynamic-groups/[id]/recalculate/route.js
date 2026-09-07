"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const recalculate_dynamic_group_1 = require("../../../../../workflows/recalculate-dynamic-group");
async function POST(req, res) {
    const { result } = await (0, recalculate_dynamic_group_1.recalculateDynamicGroupWorkflow)(req.scope).run({
        input: { id: req.params.id },
    });
    res.status(202).json({ stats: result });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2R5bmFtaWMtZ3JvdXBzL1tpZF0vcmVjYWxjdWxhdGUvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQSxvQkFLQztBQVBELGtHQUFxRztBQUU5RixLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBQSwyREFBK0IsRUFBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDO1FBQ3RFLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksRUFBRTtLQUN2QyxDQUFDLENBQUM7SUFDSCxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQzFDLENBQUMifQ==