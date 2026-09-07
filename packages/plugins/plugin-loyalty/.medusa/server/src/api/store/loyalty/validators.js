"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedeemSchema = void 0;
const zod_1 = require("zod");
exports.RedeemSchema = zod_1.z.object({
    reward_id: zod_1.z.string().min(1),
    sales_channel_id: zod_1.z.string().nullish(),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvc3RvcmUvbG95YWx0eS92YWxpZGF0b3JzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZCQUF3QjtBQUVYLFFBQUEsWUFBWSxHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDbkMsU0FBUyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzVCLGdCQUFnQixFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLEVBQUU7Q0FDdkMsQ0FBQyxDQUFDIn0=