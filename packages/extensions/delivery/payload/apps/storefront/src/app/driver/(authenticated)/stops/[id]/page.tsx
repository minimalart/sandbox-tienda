import type { Metadata } from "next";
import StopDetail from "@modules/driver/components/stop-detail";

export const metadata: Metadata = {
  title: "Detalle de parada",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StopDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <StopDetail executionId={id} />;
}
