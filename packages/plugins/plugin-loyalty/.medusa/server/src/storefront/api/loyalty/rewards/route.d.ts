import { NextResponse } from "next/server";
export declare function GET(): Promise<NextResponse<{
    success: boolean;
    message: string;
}> | NextResponse<{
    success: boolean;
    rewards: unknown[];
    points_name: string;
}>>;
