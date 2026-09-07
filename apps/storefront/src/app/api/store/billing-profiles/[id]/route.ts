import {
  deleteBillingProfile,
  updateBillingProfile,
} from "@lib/data/billing-profile";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await request.json();
  const result = await updateBillingProfile(id, data);
  return NextResponse.json(result);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await deleteBillingProfile(id);
  return NextResponse.json(result);
}
