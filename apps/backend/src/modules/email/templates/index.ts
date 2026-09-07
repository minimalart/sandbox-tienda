import { companyRegisterTemplate } from './company-register';
import { customerRegisterTemplate } from './customer-register';
import { b2bClientApprovedTemplate } from './b2b-client-approved';
import { orderConfirmationTemplate } from './order-confirmation';
import { orderNotificationAdminTemplate } from './order-notification-admin';
import { quotationNotificationAdminTemplate } from './quotation-notification-admin';
import { quotationRejectedAdminTemplate } from './quotation-rejected-admin';
import { passwordResetTemplate } from './password-reset';
import { kitCdeNotificationTemplate } from './kit-cde-notification';
import { orderTrackingTemplate } from './order-tracking';
import { orderCancelledTemplate } from './order-cancelled';
import { orderInvoiceTemplate } from './order-invoice';
import { stockSyncReportTemplate } from './stock-sync-report';
import { inviteTemplate } from './invite';
import {
  cartAbandonedStep1Template,
  cartAbandonedStep2Template,
  cartAbandonedStep3Template,
} from './cart-abandoned';
import { whatsappHandoffAdminTemplate } from './whatsapp-handoff-admin';
import { returnRequestedTemplate } from './return-requested';
import type { EmailTemplates } from './types';

export type { EmailTemplateFunction, EmailTemplateResult, EmailTemplates } from './types';

export const templates = {
  'company-register': companyRegisterTemplate,
  'customer-register': customerRegisterTemplate,
  'b2b-client-approved': b2bClientApprovedTemplate,
  'password-reset': passwordResetTemplate,
  'order-confirmation': orderConfirmationTemplate,
  'order-notification-admin': orderNotificationAdminTemplate,
  'quotation-notification-admin': quotationNotificationAdminTemplate,
  'quotation-rejected-admin': quotationRejectedAdminTemplate,
  'kit-cde-notification': kitCdeNotificationTemplate,
  'order-tracking': orderTrackingTemplate,
  'order-cancelled': orderCancelledTemplate,
  'order-invoice': orderInvoiceTemplate,
  'stock-sync-report': stockSyncReportTemplate,
  'admin-invite': inviteTemplate,
  'cart-abandoned-1': cartAbandonedStep1Template,
  'cart-abandoned-2': cartAbandonedStep2Template,
  'cart-abandoned-3': cartAbandonedStep3Template,
  'whatsapp-handoff-admin': whatsappHandoffAdminTemplate,
  'return-requested': returnRequestedTemplate,
} as unknown as EmailTemplates;
