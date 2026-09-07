import { MedusaService } from '@medusajs/framework/utils';
import NewsletterSubscription from './models/newsletter-subscription';

class NewsletterModuleService extends MedusaService({ NewsletterSubscription }) {}

export default NewsletterModuleService;
