"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatGACartItems = void 0;
const formatGACartItems = (items, cartOrOrder) => {
    return items?.map((item, index) => ({
        item_id: item.variant_id,
        item_name: item.product_title,
        affiliation: cartOrOrder.sales_channel_id,
        discount: item.discount_total,
        index,
        item_category: item.variant?.product?.categories?.map((c) => c.name).join(','),
        item_variant: item.variant_title,
        location_id: cartOrOrder.sales_channel_id,
        price: item.unit_price,
        quantity: item.quantity,
    }));
};
exports.formatGACartItems = formatGACartItems;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9ybWF0LWdhLWl0ZW1zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvZ2E0L2xpYi9mb3JtYXQtZ2EtaXRlbXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBb0JPLE1BQU0saUJBQWlCLEdBQUcsQ0FDL0IsS0FBaUMsRUFDakMsV0FBNEIsRUFDVyxFQUFFO0lBQ3pDLE9BQU8sS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDbEMsT0FBTyxFQUFFLElBQUksQ0FBQyxVQUFVO1FBQ3hCLFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYTtRQUM3QixXQUFXLEVBQUUsV0FBVyxDQUFDLGdCQUFnQjtRQUN6QyxRQUFRLEVBQUUsSUFBSSxDQUFDLGNBQWM7UUFDN0IsS0FBSztRQUNMLGFBQWEsRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUM5RSxZQUFZLEVBQUUsSUFBSSxDQUFDLGFBQWE7UUFDaEMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxnQkFBZ0I7UUFDekMsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVO1FBQ3RCLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtLQUN4QixDQUFDLENBQUMsQ0FBQztBQUNOLENBQUMsQ0FBQztBQWhCVyxRQUFBLGlCQUFpQixxQkFnQjVCIn0=