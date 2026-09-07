"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const sdk_1 = require("../../../lib/sdk");
const server_1 = require("next/server");
const headers_1 = require("next/headers");
async function getAuthToken() {
    const cookieStore = await (0, headers_1.cookies)();
    return cookieStore.get("_medusa_jwt")?.value;
}
// POST /api/store/loyalty/redeem — redeem a reward. Body: { reward_id }.
async function POST(request) {
    const token = await getAuthToken();
    if (!token) {
        return server_1.NextResponse.json({ success: false, message: "No autenticado" }, { status: 401 });
    }
    try {
        const body = await request.json();
        const rewardId = body?.reward_id;
        if (!rewardId || typeof rewardId !== "string") {
            return server_1.NextResponse.json({ success: false, message: "reward_id requerido" }, { status: 400 });
        }
        const result = await sdk_1.sdk.client.fetch("/store/loyalty/redeem", {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: { reward_id: rewardId },
        });
        return server_1.NextResponse.json({ success: true, grant: result.grant, already: result.already ?? false });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Error al canjear la recompensa";
        return server_1.NextResponse.json({ success: false, message }, { status: 400 });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc3RvcmVmcm9udC9hcGkvbG95YWx0eS9yZWRlZW0vcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFVQSxvQkF3QkM7QUFsQ0QsMENBQXVDO0FBQ3ZDLHdDQUEyQztBQUMzQywwQ0FBdUM7QUFFdkMsS0FBSyxVQUFVLFlBQVk7SUFDekIsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFBLGlCQUFPLEdBQUUsQ0FBQztJQUNwQyxPQUFPLFdBQVcsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLEVBQUUsS0FBSyxDQUFDO0FBQy9DLENBQUM7QUFFRCx5RUFBeUU7QUFDbEUsS0FBSyxVQUFVLElBQUksQ0FBQyxPQUFnQjtJQUN6QyxNQUFNLEtBQUssR0FBRyxNQUFNLFlBQVksRUFBRSxDQUFDO0lBQ25DLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNYLE9BQU8scUJBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDM0YsQ0FBQztJQUNELElBQUksQ0FBQztRQUNILE1BQU0sSUFBSSxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2xDLE1BQU0sUUFBUSxHQUFHLElBQUksRUFBRSxTQUFTLENBQUM7UUFDakMsSUFBSSxDQUFDLFFBQVEsSUFBSSxPQUFPLFFBQVEsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUM5QyxPQUFPLHFCQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ2hHLENBQUM7UUFDRCxNQUFNLE1BQU0sR0FBRyxNQUFNLFNBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUNuQyx1QkFBdUIsRUFDdkI7WUFDRSxNQUFNLEVBQUUsTUFBTTtZQUNkLE9BQU8sRUFBRSxFQUFFLGFBQWEsRUFBRSxVQUFVLEtBQUssRUFBRSxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRTtZQUNqRixJQUFJLEVBQUUsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFO1NBQzlCLENBQ0YsQ0FBQztRQUNGLE9BQU8scUJBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxJQUFJLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDckcsQ0FBQztJQUFDLE9BQU8sS0FBYyxFQUFFLENBQUM7UUFDeEIsTUFBTSxPQUFPLEdBQUcsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsZ0NBQWdDLENBQUM7UUFDMUYsT0FBTyxxQkFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUN6RSxDQUFDO0FBQ0gsQ0FBQyJ9