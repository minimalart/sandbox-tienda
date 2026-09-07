import { retrieveCustomer } from "@lib/data/customer";
import AvatarUpload from "@modules/account/components/avatar-upload";
import ChangePasswordCard from "@modules/account/components/change-password-card";
import CustomerDetailsCard from "@modules/account/components/customer-details-card";
import PageHeader from "@modules/b2b/components/portal/page-header";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Mi perfil | Mayorista" };

export default async function PerfilPage() {
  const customer = await retrieveCustomer().catch(() => null);

  if (!customer) {
    redirect("/b2b/login");
  }

  return (
    <div className="space-y-5" data-testid="b2b-profile-page-wrapper">
      <PageHeader
        title="Mi perfil"
        description="Actualizá tu nombre, email, teléfono y contraseña."
      />

      <div className="space-y-4">
        <AvatarUpload customer={customer} />
        <CustomerDetailsCard customer={customer} />
        <ChangePasswordCard customer={customer} />
      </div>
    </div>
  );
}
