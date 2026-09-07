"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const product_1 = __importDefault(require("@medusajs/medusa/product"));
const utils_1 = require("@medusajs/framework/utils");
const brand_1 = __importDefault(require("../modules/brand"));
exports.default = (0, utils_1.defineLink)({
    linkable: product_1.default.linkable.product,
    isList: true,
}, {
    linkable: brand_1.default.linkable.brand,
    isList: false,
}, {
    database: {
        table: 'product_product_brand_brand',
        idPrefix: 'pbrnd',
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZHVjdC1icmFuZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9saW5rcy9wcm9kdWN0LWJyYW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsdUVBQXFEO0FBQ3JELHFEQUF1RDtBQUN2RCw2REFBMkM7QUFFM0Msa0JBQWUsSUFBQSxrQkFBVSxFQUN2QjtJQUNFLFFBQVEsRUFBRSxpQkFBYSxDQUFDLFFBQVEsQ0FBQyxPQUFPO0lBQ3hDLE1BQU0sRUFBRSxJQUFJO0NBQ2IsRUFDRDtJQUNFLFFBQVEsRUFBRSxlQUFXLENBQUMsUUFBUSxDQUFDLEtBQUs7SUFDcEMsTUFBTSxFQUFFLEtBQUs7Q0FDZCxFQUNEO0lBQ0UsUUFBUSxFQUFFO1FBQ1IsS0FBSyxFQUFFLDZCQUE2QjtRQUNwQyxRQUFRLEVBQUUsT0FBTztLQUNsQjtDQUNGLENBQ0YsQ0FBQyJ9