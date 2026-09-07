import type { Metadata } from "next";
import StopsList from "@modules/driver/components/stops-list";

export const metadata: Metadata = {
  title: "Mis paradas",
};

export default function StopsPage() {
  return <StopsList />;
}
