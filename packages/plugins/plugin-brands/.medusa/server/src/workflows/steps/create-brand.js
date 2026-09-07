"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBrandStep = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const brand_1 = require("../../modules/brand");
exports.createBrandStep = (0, workflows_sdk_1.createStep)('create-brand-step', async (input, { container }) => {
    const brandService = container.resolve(brand_1.BRAND_MODULE);
    // `sales_channel_ids` es un array en una columna model.json() (tipada como
    // Record por Medusa); casteamos para el create.
    const brand = await brandService.createBrands(input);
    return new workflows_sdk_1.StepResponse(brand, brand);
}, async (compensationData, { container }) => {
    if (!compensationData) {
        return;
    }
    const brandService = container.resolve(brand_1.BRAND_MODULE);
    await brandService.deleteBrands(compensationData.id);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWJyYW5kLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3dvcmtmbG93cy9zdGVwcy9jcmVhdGUtYnJhbmQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUVBQTZFO0FBQzdFLCtDQUFtRDtBQVl0QyxRQUFBLGVBQWUsR0FBRyxJQUFBLDBCQUFVLEVBQ3ZDLG1CQUFtQixFQUNuQixLQUFLLEVBQUUsS0FBMkIsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDbkQsTUFBTSxZQUFZLEdBQXVCLFNBQVMsQ0FBQyxPQUFPLENBQUMsb0JBQVksQ0FBQyxDQUFDO0lBRXpFLDJFQUEyRTtJQUMzRSxnREFBZ0Q7SUFDaEQsTUFBTSxLQUFLLEdBQUcsTUFBTSxZQUFZLENBQUMsWUFBWSxDQUFDLEtBQVksQ0FBQyxDQUFDO0lBRTVELE9BQU8sSUFBSSw0QkFBWSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztBQUN4QyxDQUFDLEVBQ0QsS0FBSyxFQUFFLGdCQUFnQixFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUN4QyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN0QixPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sWUFBWSxHQUF1QixTQUFTLENBQUMsT0FBTyxDQUFDLG9CQUFZLENBQUMsQ0FBQztJQUV6RSxNQUFNLFlBQVksQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDdkQsQ0FBQyxDQUNGLENBQUMifQ==