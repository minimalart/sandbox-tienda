"use client";

import type { HttpTypes } from "@medusajs/types";
import React from "react";

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer;
};

const ProfileEmail: React.FC<MyInformationProps> = ({ customer }) => {
  return (
    <div
      className="border-gray-200 border-t py-6 text-sm/6 sm:flex"
      data-testid="account-email-editor"
    >
      <dt className="font-medium text-gray-900 sm:w-64 sm:flex-none sm:pr-6">
        Correo electrónico
      </dt>
      <dd className="mt-1 flex justify-between gap-x-6 sm:mt-0 sm:flex-auto">
        <div className="text-gray-900">
          <span data-testid="current-info">{customer.email}</span>
        </div>
        <span className="text-gray-400 text-sm">No editable</span>
      </dd>
    </div>
  );
};

export default ProfileEmail;
