"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseExplorerService = databaseExplorerService;
exports.actorId = actorId;
exports.queryString = queryString;
exports.parseFilters = parseFilters;
const database_explorer_1 = require("../../../modules/database-explorer");
function databaseExplorerService(req) {
    return req.scope.resolve(database_explorer_1.DATABASE_EXPLORER_MODULE);
}
function actorId(req) {
    return req.auth_context?.actor_id ?? null;
}
function queryString(value) {
    return typeof value === 'string' ? value : undefined;
}
function parseFilters(value) {
    if (typeof value !== 'string' || !value.trim())
        return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : {};
    }
    catch {
        return {};
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2RhdGFiYXNlLWV4cGxvcmVyL3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBSUEsMERBRUM7QUFFRCwwQkFFQztBQUVELGtDQUVDO0FBRUQsb0NBVUM7QUF6QkQsMEVBQThFO0FBRzlFLFNBQWdCLHVCQUF1QixDQUFDLEdBQWtCO0lBQ3hELE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQWdDLDRDQUF3QixDQUFDLENBQUM7QUFDcEYsQ0FBQztBQUVELFNBQWdCLE9BQU8sQ0FBQyxHQUFrQjtJQUN4QyxPQUFRLEdBQWdELENBQUMsWUFBWSxFQUFFLFFBQVEsSUFBSSxJQUFJLENBQUM7QUFDMUYsQ0FBQztBQUVELFNBQWdCLFdBQVcsQ0FBQyxLQUFjO0lBQ3hDLE9BQU8sT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUN2RCxDQUFDO0FBRUQsU0FBZ0IsWUFBWSxDQUFDLEtBQWM7SUFDekMsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFO1FBQUUsT0FBTyxFQUFFLENBQUM7SUFDMUQsSUFBSSxDQUFDO1FBQ0gsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQVksQ0FBQztRQUM1QyxPQUFPLE1BQU0sSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztZQUNuRSxDQUFDLENBQUUsTUFBa0M7WUFDckMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUNULENBQUM7SUFBQyxNQUFNLENBQUM7UUFDUCxPQUFPLEVBQUUsQ0FBQztJQUNaLENBQUM7QUFDSCxDQUFDIn0=