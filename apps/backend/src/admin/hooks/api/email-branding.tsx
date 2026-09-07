import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../lib/client';

const EMAIL_BRANDING_URL = '/admin/store-config/email-branding';
const EMAIL_BRANDING_KEY = ['email-branding'] as const;

export interface EmailBranding {
  primary_color: string;
  text_color: string;
  logo_url: string | null;
  cde_display_name: string | null;
  admin_notification_email: string | null;
}

export interface EmailBrandingResponse {
  email_branding: EmailBranding;
}

export function useEmailBranding() {
  return useQuery({
    queryKey: EMAIL_BRANDING_KEY,
    queryFn: () =>
      sdk.client.fetch<EmailBrandingResponse>(EMAIL_BRANDING_URL, {
        method: 'GET',
      }),
  });
}

export function useUpdateEmailBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<EmailBranding>) =>
      sdk.client.fetch<EmailBrandingResponse>(EMAIL_BRANDING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EMAIL_BRANDING_KEY });
    },
  });
}
