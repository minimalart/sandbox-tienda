import {
  createBillingProfile,
  listBillingProfiles,
} from "@lib/data/billing-profile";
import { NextResponse } from "next/server";

export async function GET() {
  const billing_profiles = await listBillingProfiles();
  return NextResponse.json({ billing_profiles });
}

export async function POST(request: Request) {
  const data = await request.json();
  const result = await createBillingProfile(data);
  return NextResponse.json(result);
}
