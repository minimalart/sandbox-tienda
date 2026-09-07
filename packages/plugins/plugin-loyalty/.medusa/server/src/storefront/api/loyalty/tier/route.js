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
// GET /api/store/loyalty/tier — the customer's current tier + progress.
async function GET() {
    const token = await getAuthToken();
    if (!token) {
        return server_1.NextResponse.json({ success: false, message: "No autenticado" }, { status: 401 });
    }
    try {
        const result = await sdk_1.sdk.client.fetch("/store/loyalty/tier", {
            method: "GET",
            headers: { authorization: `Bearer ${token}` },
            cache: "no-store",
        });
        return server_1.NextResponse.json({
            success: true,
            tier: result.tier ?? null,
            next: result.next ?? null,
            toNext: result.toNext ?? 0,
            metrics: result.metrics ?? null,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Error al obtener el nivel";
        return server_1.NextResponse.json({ success: false, message }, { status: 400 });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc3RvcmVmcm9udC9hcGkvbG95YWx0eS90aWVyL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBVUEsa0JBMkJDO0FBckNELDBDQUF1QztBQUN2Qyx3Q0FBMkM7QUFDM0MsMENBQXVDO0FBRXZDLEtBQUssVUFBVSxZQUFZO0lBQ3pCLE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBQSxpQkFBTyxHQUFFLENBQUM7SUFDcEMsT0FBTyxXQUFXLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLEtBQUssQ0FBQztBQUMvQyxDQUFDO0FBRUQsd0VBQXdFO0FBQ2pFLEtBQUssVUFBVSxHQUFHO0lBQ3ZCLE1BQU0sS0FBSyxHQUFHLE1BQU0sWUFBWSxFQUFFLENBQUM7SUFDbkMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ1gsT0FBTyxxQkFBWSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUMzRixDQUFDO0lBQ0QsSUFBSSxDQUFDO1FBQ0gsTUFBTSxNQUFNLEdBQUcsTUFBTSxTQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FLbEMscUJBQXFCLEVBQUU7WUFDeEIsTUFBTSxFQUFFLEtBQUs7WUFDYixPQUFPLEVBQUUsRUFBRSxhQUFhLEVBQUUsVUFBVSxLQUFLLEVBQUUsRUFBRTtZQUM3QyxLQUFLLEVBQUUsVUFBVTtTQUNsQixDQUFDLENBQUM7UUFDSCxPQUFPLHFCQUFZLENBQUMsSUFBSSxDQUFDO1lBQ3ZCLE9BQU8sRUFBRSxJQUFJO1lBQ2IsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLElBQUksSUFBSTtZQUN6QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksSUFBSSxJQUFJO1lBQ3pCLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUM7WUFDMUIsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLElBQUksSUFBSTtTQUNoQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBQUMsT0FBTyxLQUFjLEVBQUUsQ0FBQztRQUN4QixNQUFNLE9BQU8sR0FBRyxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQywyQkFBMkIsQ0FBQztRQUNyRixPQUFPLHFCQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3pFLENBQUM7QUFDSCxDQUFDIn0=