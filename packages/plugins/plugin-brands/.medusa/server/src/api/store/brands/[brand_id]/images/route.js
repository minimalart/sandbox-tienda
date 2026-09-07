"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
async function GET(req, res) {
    const brand_id = req.params.brand_id;
    const query = req.scope.resolve('query');
    const { data: brandImages } = await query.graph({
        entity: 'brand_image',
        fields: ['*'],
        filters: {
            brand_id,
        },
    });
    res.status(200).json({ images: brandImages });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2JyYW5kcy9bYnJhbmRfaWRdL2ltYWdlcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUVBLGtCQWFDO0FBYk0sS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBa0IsQ0FBQztJQUMvQyxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUV6QyxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxHQUFHLE1BQU0sS0FBSyxDQUFDLEtBQUssQ0FBQztRQUM5QyxNQUFNLEVBQUUsYUFBYTtRQUNyQixNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUM7UUFDYixPQUFPLEVBQUU7WUFDUCxRQUFRO1NBQ1Q7S0FDRixDQUFDLENBQUM7SUFFSCxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO0FBQ2hELENBQUMifQ==