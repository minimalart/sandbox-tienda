import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/store/typesense/analytics
 * Track search queries by calling backend public API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, message: "Query parameter is required" },
        { status: 400 }
      );
    }

    // Call backend public API to track the search query
    const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
    const response = await fetch(`${backendUrl}/store/typesense/analytics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.warn("[TYPESENSE ANALYTICS] Backend analytics tracking failed");
      return NextResponse.json({ success: false }, { status: 200 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[TYPESENSE ANALYTICS] Error tracking search query:", error);
    return NextResponse.json(
      { success: false, message: "Error tracking search query" },
      { status: 500 }
    );
  }
}
