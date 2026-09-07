import { getMyCompany } from "@lib/data/company";
import CompanyUsers from "@modules/b2b/components/company-users";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mi empresa | Mayorista" };

export default async function EmpresaPage() {
  const data = await getMyCompany();
  if (!data.company) return null;
  return (
    <CompanyUsers data={data} googleMapsApiKey={process.env.GOOGLE_MAPS_API_KEY ?? ""} />
  );
}
