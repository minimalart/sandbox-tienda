"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShopByLookWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const create_shop_by_look_1 = require("./steps/create-shop-by-look");
exports.createShopByLookWorkflow = (0, workflows_sdk_1.createWorkflow)('create-shop-by-look', (input) => {
    const look = (0, create_shop_by_look_1.createShopByLookStep)(input);
    return new workflows_sdk_1.WorkflowResponse(look);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLXNob3AtYnktbG9vay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3MvY3JlYXRlLXNob3AtYnktbG9vay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxRUFBcUY7QUFDckYscUVBR3FDO0FBSXhCLFFBQUEsd0JBQXdCLEdBQUcsSUFBQSw4QkFBYyxFQUNwRCxxQkFBcUIsRUFDckIsQ0FBQyxLQUE0QixFQUFFLEVBQUU7SUFDL0IsTUFBTSxJQUFJLEdBQUcsSUFBQSwwQ0FBb0IsRUFBQyxLQUFLLENBQUMsQ0FBQztJQUV6QyxPQUFPLElBQUksZ0NBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDcEMsQ0FBQyxDQUNGLENBQUMifQ==