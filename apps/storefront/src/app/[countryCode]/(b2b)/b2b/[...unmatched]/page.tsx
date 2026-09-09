import { requireB2BStore } from "@lib/site-config/require-b2b-store";
import { notFound } from "next/navigation";

export default async function UnknownB2BPage() {
  await requireB2BStore();
  notFound();
}
