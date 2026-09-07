import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Subscription consent endpoint.
 * TODO: Store consent records in your preferred backend (database, CRM, etc.)
 * For now this is a no-op that logs and returns success.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // TODO: persist consent record
    console.log("[SubscriptionConsent] Consent received:", body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SubscriptionConsent] Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
