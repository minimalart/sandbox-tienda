/**
 * Widget read-only en el detalle de Customer: lista los perfiles de facturación
 * del cliente. El ABM lo hace el propio cliente en "Mi cuenta".
 *
 * Zona: customer.details.after
 */
import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { DetailWidgetProps } from '@medusajs/framework/types';
import { Container, Heading, StatusBadge, Table, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { registerWidgetsTranslations } from '../translations/widgets';
import { useCustomerBillingProfiles } from '../hooks/api/billing-profiles';

type AdminCustomer = { id: string };

const CustomerBillingProfilesWidget = ({
  data: customer,
}: DetailWidgetProps<AdminCustomer>) => {
  const { t, i18n } = useTranslation('widgets');
  registerWidgetsTranslations(i18n);

  const { data, isLoading } = useCustomerBillingProfiles(customer.id);
  const profiles = data?.billing_profiles ?? [];

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">{t('BILLING_PROFILES_HEADING')}</Heading>
      </div>
      <div className="px-6 py-4">
        {isLoading ? (
          <Text size="small" className="text-ui-fg-muted">
            {t('BILLING_LOADING')}
          </Text>
        ) : profiles.length === 0 ? (
          <Text size="small" className="text-ui-fg-muted">
            {t('BILLING_EMPTY')}
          </Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t('BILLING_LABEL')}</Table.HeaderCell>
                <Table.HeaderCell>{t('BILLING_LEGAL_NAME')}</Table.HeaderCell>
                <Table.HeaderCell>{t('BILLING_CUIT')}</Table.HeaderCell>
                <Table.HeaderCell>{t('BILLING_TAX_CONDITION')}</Table.HeaderCell>
                <Table.HeaderCell> </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {profiles.map((p) => (
                <Table.Row key={p.id}>
                  <Table.Cell>{p.label}</Table.Cell>
                  <Table.Cell>{p.legal_name}</Table.Cell>
                  <Table.Cell className="font-mono">{p.document_number}</Table.Cell>
                  <Table.Cell>{p.tax_condition}</Table.Cell>
                  <Table.Cell>
                    {p.is_default ? (
                      <StatusBadge color="green">
                        {t('BILLING_DEFAULT')}
                      </StatusBadge>
                    ) : null}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: 'customer.details.after',
});

export default CustomerBillingProfilesWidget;
