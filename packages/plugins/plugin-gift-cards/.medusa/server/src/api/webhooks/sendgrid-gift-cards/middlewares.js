"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendGridGiftCardWebhookMiddlewares = void 0;
exports.sendGridGiftCardWebhookMiddlewares = [{
        matcher: '/webhooks/sendgrid-gift-cards',
        method: ['POST'],
        bodyParser: { preserveRawBody: true, sizeLimit: '1mb' },
        middlewares: [],
    }];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3dlYmhvb2tzL3NlbmRncmlkLWdpZnQtY2FyZHMvbWlkZGxld2FyZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRWEsUUFBQSxrQ0FBa0MsR0FBc0IsQ0FBQztRQUNwRSxPQUFPLEVBQUUsK0JBQStCO1FBQ3hDLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQztRQUNoQixVQUFVLEVBQUUsRUFBRSxlQUFlLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUU7UUFDdkQsV0FBVyxFQUFFLEVBQUU7S0FDaEIsQ0FBQyxDQUFDIn0=