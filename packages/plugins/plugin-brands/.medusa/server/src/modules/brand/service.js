"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
class BrandModuleService extends (0, utils_1.MedusaService)({
    Brand: models_1.Brand,
    BrandImage: models_1.BrandImage,
    ProductBrandLink: models_1.ProductBrandLink,
}) {
}
exports.default = BrandModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2JyYW5kL3NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxxREFBMEQ7QUFDMUQscUNBQStEO0FBRS9ELE1BQU0sa0JBQW1CLFNBQVEsSUFBQSxxQkFBYSxFQUFDO0lBQzdDLEtBQUssRUFBTCxjQUFLO0lBQ0wsVUFBVSxFQUFWLG1CQUFVO0lBQ1YsZ0JBQWdCLEVBQWhCLHlCQUFnQjtDQUNqQixDQUFDO0NBQUc7QUFFTCxrQkFBZSxrQkFBa0IsQ0FBQyJ9