"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const brand_1 = require("../../../../modules/brand");
async function GET(req, res) {
    const brand_id = req.params.brand_id;
    const brandService = req.scope.resolve(brand_1.BRAND_MODULE);
    const brand = await brandService.retrieveBrand(brand_id);
    if (!brand.is_active) {
        res.status(404).json({ message: 'Brand not found' });
        return;
    }
    res.status(200).json({ brand });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2JyYW5kcy9bYnJhbmRfaWRdL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBSUEsa0JBWUM7QUFmRCxxREFBeUQ7QUFHbEQsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBa0IsQ0FBQztJQUMvQyxNQUFNLFlBQVksR0FBdUIsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsb0JBQVksQ0FBQyxDQUFDO0lBRXpFLE1BQU0sS0FBSyxHQUFHLE1BQU0sWUFBWSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUV6RCxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ3JCLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUNyRCxPQUFPO0lBQ1QsQ0FBQztJQUVELEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUNsQyxDQUFDIn0=