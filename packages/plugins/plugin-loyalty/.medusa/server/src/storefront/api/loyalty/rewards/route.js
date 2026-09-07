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
// GET /api/store/loyalty/rewards — redeemable rewards for the active program.
async function GET() {
    const token = await getAuthToken();
    if (!token) {
        return server_1.NextResponse.json({ success: false, message: "No autenticado" }, { status: 401 });
    }
    try {
        const result = await sdk_1.sdk.client.fetch("/store/loyalty/rewards", { method: "GET", headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
        return server_1.NextResponse.json({
            success: true,
            rewards: result.rewards ?? [],
            points_name: result.points_name ?? "puntos",
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Error al obtener recompensas";
        return server_1.NextResponse.json({ success: false, message }, { status: 400 });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc3RvcmVmcm9udC9hcGkvbG95YWx0eS9yZXdhcmRzL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBVUEsa0JBbUJDO0FBN0JELDBDQUF1QztBQUN2Qyx3Q0FBMkM7QUFDM0MsMENBQXVDO0FBRXZDLEtBQUssVUFBVSxZQUFZO0lBQ3pCLE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBQSxpQkFBTyxHQUFFLENBQUM7SUFDcEMsT0FBTyxXQUFXLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLEtBQUssQ0FBQztBQUMvQyxDQUFDO0FBRUQsOEVBQThFO0FBQ3ZFLEtBQUssVUFBVSxHQUFHO0lBQ3ZCLE1BQU0sS0FBSyxHQUFHLE1BQU0sWUFBWSxFQUFFLENBQUM7SUFDbkMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ1gsT0FBTyxxQkFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUMzRixDQUFDO0lBQ0QsSUFBSSxDQUFDO1FBQ0gsTUFBTSxNQUFNLEdBQUcsTUFBTSxTQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FDbkMsd0JBQXdCLEVBQ3hCLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsRUFBRSxhQUFhLEVBQUUsVUFBVSxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsQ0FDcEYsQ0FBQztRQUNGLE9BQU8scUJBQVksQ0FBQyxJQUFJLENBQUM7WUFDdkIsT0FBTyxFQUFFLElBQUk7WUFDYixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sSUFBSSxFQUFFO1lBQzdCLFdBQVcsRUFBRSxNQUFNLENBQUMsV0FBVyxJQUFJLFFBQVE7U0FDNUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUFDLE9BQU8sS0FBYyxFQUFFLENBQUM7UUFDeEIsTUFBTSxPQUFPLEdBQUcsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsOEJBQThCLENBQUM7UUFDeEYsT0FBTyxxQkFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUN6RSxDQUFDO0FBQ0gsQ0FBQyJ9