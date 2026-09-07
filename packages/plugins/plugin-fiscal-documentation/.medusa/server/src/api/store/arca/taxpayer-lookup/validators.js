"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostArcaTaxpayerLookup = void 0;
const zod_1 = require("zod");
const cuit_1 = require("../../../../lib/cuit");
exports.PostArcaTaxpayerLookup = zod_1.z.object({
    cuit: zod_1.z
        .string()
        .refine(cuit_1.validateCuit, 'CUIT inválido (revisá los 11 dígitos y el verificador).'),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvc3RvcmUvYXJjYS90YXhwYXllci1sb29rdXAvdmFsaWRhdG9ycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2QkFBd0I7QUFDeEIsK0NBQW9EO0FBRXZDLFFBQUEsc0JBQXNCLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUM3QyxJQUFJLEVBQUUsT0FBQztTQUNKLE1BQU0sRUFBRTtTQUNSLE1BQU0sQ0FBQyxtQkFBWSxFQUFFLHlEQUF5RCxDQUFDO0NBQ25GLENBQUMsQ0FBQyJ9