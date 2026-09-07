"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const sdk_1 = require("../../lib/sdk");
const server_1 = require("next/server");
const headers_1 = require("next/headers");
async function getAuthToken() {
    const cookieStore = await (0, headers_1.cookies)();
    return cookieStore.get("_medusa_jwt")?.value;
}
// GET /api/store/points — the authenticated customer's balance + ledger.
async function GET() {
    const token = await getAuthToken();
    if (!token) {
        return server_1.NextResponse.json({ success: false, message: "No autenticado" }, { status: 401 });
    }
    const headers = { authorization: `Bearer ${token}` };
    try {
        const result = await sdk_1.sdk.client.fetch("/store/points", {
            method: "GET",
            headers,
            cache: "no-store",
        });
        return server_1.NextResponse.json({
            success: true,
            points: {
                balance: result.points?.balance ?? 0,
                transactions: result.points?.transactions ?? [],
            },
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Error al obtener puntos";
        return server_1.NextResponse.json({ success: false, message }, { status: 400 });
    }
}
// POST /api/store/points — redeem points. Body: { action: "redeem", amount }.
async function POST(request) {
    const token = await getAuthToken();
    if (!token) {
        return server_1.NextResponse.json({ success: false, message: "No autenticado" }, { status: 401 });
    }
    const headers = { authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    try {
        const body = await request.json();
        const { action, amount } = body;
        if (action !== "redeem") {
            return server_1.NextResponse.json({ success: false, message: "Acción inválida" }, { status: 400 });
        }
        if (typeof amount !== "number" || amount <= 0) {
            return server_1.NextResponse.json({ success: false, message: "amount debe ser un número positivo" }, { status: 400 });
        }
        const result = await sdk_1.sdk.client.fetch("/store/points/redeem", {
            method: "POST",
            headers,
            body: { amount },
        });
        return server_1.NextResponse.json({
            success: true,
            balance: result.balance ?? 0,
            redeemed: result.redeemed ?? amount,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Error al canjear puntos";
        return server_1.NextResponse.json({ success: false, message }, { status: 400 });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvc3RvcmVmcm9udC9hcGkvcG9pbnRzL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBbUJBLGtCQWdDQztBQUdELG9CQWdEQztBQXRHRCx1Q0FBb0M7QUFDcEMsd0NBQTJDO0FBQzNDLDBDQUF1QztBQUV2QyxLQUFLLFVBQVUsWUFBWTtJQUN6QixNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUEsaUJBQU8sR0FBRSxDQUFDO0lBQ3BDLE9BQU8sV0FBVyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsRUFBRSxLQUFLLENBQUM7QUFDL0MsQ0FBQztBQVdELHlFQUF5RTtBQUNsRSxLQUFLLFVBQVUsR0FBRztJQUN2QixNQUFNLEtBQUssR0FBRyxNQUFNLFlBQVksRUFBRSxDQUFDO0lBQ25DLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNYLE9BQU8scUJBQVksQ0FBQyxJQUFJLENBQ3RCLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsRUFDN0MsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQ2hCLENBQUM7SUFDSixDQUFDO0lBRUQsTUFBTSxPQUFPLEdBQUcsRUFBRSxhQUFhLEVBQUUsVUFBVSxLQUFLLEVBQUUsRUFBRSxDQUFDO0lBRXJELElBQUksQ0FBQztRQUNILE1BQU0sTUFBTSxHQUFHLE1BQU0sU0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBRWxDLGVBQWUsRUFBRTtZQUNsQixNQUFNLEVBQUUsS0FBSztZQUNiLE9BQU87WUFDUCxLQUFLLEVBQUUsVUFBVTtTQUNsQixDQUFDLENBQUM7UUFFSCxPQUFPLHFCQUFZLENBQUMsSUFBSSxDQUFDO1lBQ3ZCLE9BQU8sRUFBRSxJQUFJO1lBQ2IsTUFBTSxFQUFFO2dCQUNOLE9BQU8sRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sSUFBSSxDQUFD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