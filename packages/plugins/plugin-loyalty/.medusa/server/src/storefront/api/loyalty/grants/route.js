"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const sdk_1 = require("../../../lib/sdk");
const server_1 = require("next/server");
const headers_1 = require("next/headers");
async function getAuthToken() {
    const cookieStore = await (0, headers_1.cookies)();
    return cookieStore.get("_medusa_jwt")?.value;
}
// GET /api/store/loyalty/grants — the customer's obtained reward benefits.
async function GET() {
    const token = await getAuthToken();
    if (!token) {
        return server_1.NextResponse.json({ success: false, message: "No autenticado" }, { status: 401 });
    }
    try {
        const result = await sdk_1.sdk.client.fetch("/store/loyalty/grants", {
            method: "GET",
            headers: { authorization: `Bearer ${token}` },
            cache: "no-store",
        });
        return server_1.NextResponse.json({ success: true, grants: result.grants ?? [] });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Error al obtener canjes";
        return server_1.NextResponse.json({ success: false, message }, { status: 400 });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc3RvcmVmcm9udC9hcGkvbG95YWx0eS9ncmFudHMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFVQSxrQkFnQkM7QUExQkQsMENBQXVDO0FBQ3ZDLHdDQUEyQztBQUMzQywwQ0FBdUM7QUFFdkMsS0FBSyxVQUFVLFlBQVk7SUFDekIsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFBLGlCQUFPLEdBQUUsQ0FBQztJQUNwQyxPQUFPLFdBQVcsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLEVBQUUsS0FBSyxDQUFDO0FBQy9DLENBQUM7QUFFRCwyRUFBMkU7QUFDcEUsS0FBSyxVQUFVLEdBQUc7SUFDdkIsTUFBTSxLQUFLLEdBQUcsTUFBTSxZQUFZLEVBQUUsQ0FBQztJQUNuQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDWCxPQUFPLHFCQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQzNGLENBQUM7SUFDRCxJQUFJLENBQUM7UUFDSCxNQUFNLE1BQU0sR0FBRyxNQUFNLFNBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUF5Qix1QkFBdUIsRUFBRTtZQUNyRixNQUFNLEVBQUUsS0FBSztZQUNiLE9BQU8sRUFBRSxFQUFFLGFBQWEsRUFBRSxVQUFVLEtBQUssRUFBRSxFQUFFO1lBQzdDLEtBQUssRUFBRSxVQUFVO1NBQ2xCLENBQUMsQ0FBQztRQUNILE9BQU8scUJBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDM0UsQ0FBQztJQUFDLE9BQU8sS0FBYyxFQUFFLENBQUM7UUFDeEIsTUFBTSxPQUFPLEdBQUcsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMseUJBQXlCLENBQUM7UUFDbkYsT0FBTyxxQkFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUN6RSxDQUFDO0FBQ0gsQ0FBQyJ9