import { MedusaService } from '@medusajs/framework/utils';
import ContactSubmission from './models/contact-submission';

class ContactModuleService extends MedusaService({ ContactSubmission }) {}

export default ContactModuleService;
