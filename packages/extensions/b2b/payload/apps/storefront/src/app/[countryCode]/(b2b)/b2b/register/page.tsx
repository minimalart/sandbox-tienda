import { getMyCompany } from "@lib/data/company";
import { MercattoLogo, MinimalartAttribution } from "@modules/b2b/components/b2b-brand";
import CompanyRegisterForm from "@modules/b2b/components/register-form";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Registrar empresa | Portal Mayorista" };

export default async function B2BRegisterPage() {
  // Si ya tiene empresa mayorista, lo mandamos al portal.
  const { company } = await getMyCompany();
  if (company) {
    redirect("/b2b");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <MercattoLogo className="mx-auto mb-6 h-9 w-auto" />
      <CompanyRegisterForm />
      <MinimalartAttribution className="mt-10" />
    </div>
  );
}
