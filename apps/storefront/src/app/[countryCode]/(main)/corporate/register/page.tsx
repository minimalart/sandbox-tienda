import CorporateRegisterForm from "@modules/account/components/corporate/register-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registrá tu empresa",
  description: "Creá una cuenta corporativa para gestionar empleados y compras.",
};

export default function CorporateRegisterPage() {
  return (
    <div className="px-4 py-10 sm:py-14">
      <CorporateRegisterForm />
    </div>
  );
}
