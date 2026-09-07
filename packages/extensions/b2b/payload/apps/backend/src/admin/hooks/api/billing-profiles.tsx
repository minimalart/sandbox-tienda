import { useQuery } from '@tanstack/react-query';

export type BillingProfile = {
  id: string;
  customer_id: string;
  label: string;
  invoice_type: string;
  tax_condition: string;
  document_type: string;
  document_number: string;
  legal_name: string;
  billing_email: string;
  billing_phone?: string | null;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  province: string;
  postal_code: string;
  country_code: string;
  is_default: boolean;
  created_at?: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export function useCustomerBillingProfiles(customerId: string) {
  return useQuery({
    queryKey: ['billing-profiles', customerId],
    queryFn: () =>
      fetchJson<{ billing_profiles: BillingProfile[] }>(
        `/admin/customers/${customerId}/billing-profiles`,
      ),
    enabled: !!customerId,
  });
}
