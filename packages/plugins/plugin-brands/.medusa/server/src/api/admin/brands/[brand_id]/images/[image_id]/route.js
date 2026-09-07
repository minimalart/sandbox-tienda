"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = DELETE;
const brand_1 = require("../../../../../../modules/brand");
async function DELETE(req, res) {
    const { image_id } = req.params;
    const brandService = req.scope.resolve(brand_1.BRAND_MODULE);
    await brandService.deleteBrandImages([image_id]);
    res.status(200).json({ success: true, deleted_id: image_id });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2JyYW5kcy9bYnJhbmRfaWRdL2ltYWdlcy9baW1hZ2VfaWRdL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBSUEsd0JBUUM7QUFYRCwyREFBK0Q7QUFHeEQsS0FBSyxVQUFVLE1BQU0sQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2xFLE1BQU0sRUFBRSxRQUFRLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO0lBRWhDLE1BQU0sWUFBWSxHQUF1QixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxvQkFBWSxDQUFDLENBQUM7SUFFekUsTUFBTSxZQUFZLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBRWpELEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztBQUNoRSxDQUFDIn0=