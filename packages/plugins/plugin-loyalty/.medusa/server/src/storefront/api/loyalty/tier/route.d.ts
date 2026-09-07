import { NextResponse } from "next/server";
export declare function GET(): Promise<NextResponse<{
    success: boolean;
    message: string;
}> | NextResponse<{
    success: boolean;
    tier: {} | null;
    next: {} | null;
    toNext: number;
    metrics: {} | null;
}>>;
