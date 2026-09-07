import { retrieveCustomer } from "@lib/data/customer";
import AvatarUpload from "@modules/account/components/avatar-upload";
import ChangePasswordCard from "@modules/account/components/change-password-card";
import CustomerDetailsCard from "@modules/account/components/customer-details-card";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Mi cuenta",
  description: "Gestioná tus datos personales.",
};

export default async function Profile() {
  const customer = await retrieveCustomer();

  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-6" data-testid="profile-page-wrapper">
      <div>
        <h2 className="font-semibold text-base/7 text-gray-900">
          Mi cuenta
        </h2>
        <p className="mt-1 text-gray-500 text-sm/6">
          Actualizá tu nombre, email, teléfono y contraseña.
        </p>
      </div>
      <div className="space-y-4">
        <AvatarUpload customer={customer} />
        <CustomerDetailsCard customer={customer} />
        <ChangePasswordCard customer={customer} />
      </div>
    </div>
  );
}
