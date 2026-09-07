import { getInvitation } from "@lib/data/corporate";
import { retrieveCustomer } from "@lib/data/customer";
import AcceptInvitation from "@modules/account/components/corporate/accept-invitation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invitación a empresa",
};

export default async function CorporateInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [invitation, customer] = await Promise.all([
    getInvitation(token),
    retrieveCustomer().catch(() => null),
  ]);

  return (
    <div className="px-4 py-10 sm:py-14">
      <AcceptInvitation token={token} invitation={invitation} isLoggedIn={!!customer} />
    </div>
  );
}
