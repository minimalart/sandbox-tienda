import { NextResponse } from "next/server";
type PointsTransaction = {
    id: string;
    amount: number;
    type: string;
    reference: string | null;
    reference_id: string | null;
    created_at: string;
};
export declare function GET(): Promise<NextResponse<{
    success: boolean;
    message: string;
}> | NextResponse<{
    success: boolean;
    points: {
        balance: number;
        transactions: PointsTransaction[];
    };
}>>;
export declare function POST(request: Request): Promise<NextResponse<{
    success: boolean;
    message: string;
}> | NextResponse<{
    success: boolean;
    balance: number;
    redeemed: number;
}>>;
export {};
