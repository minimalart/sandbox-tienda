"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.giftCardsMiddlewares = exports.sendGridGiftCardWebhookMiddlewares = exports.storeGiftCardExperienceMiddlewares = exports.adminGiftCardExperienceMiddlewares = void 0;
const middlewares_1 = require("./api/admin/gift-card-experience/middlewares");
Object.defineProperty(exports, "adminGiftCardExperienceMiddlewares", { enumerable: true, get: function () { return middlewares_1.adminGiftCardExperienceMiddlewares; } });
const middlewares_2 = require("./api/store/gift-card-experience/middlewares");
Object.defineProperty(exports, "storeGiftCardExperienceMiddlewares", { enumerable: true, get: function () { return middlewares_2.storeGiftCardExperienceMiddlewares; } });
const middlewares_3 = require("./api/webhooks/sendgrid-gift-cards/middlewares");
Object.defineProperty(exports, "sendGridGiftCardWebhookMiddlewares", { enumerable: true, get: function () { return middlewares_3.sendGridGiftCardWebhookMiddlewares; } });
exports.giftCardsMiddlewares = [
    ...middlewares_1.adminGiftCardExperienceMiddlewares,
    ...middlewares_2.storeGiftCardExperienceMiddlewares,
    ...middlewares_3.sendGridGiftCardWebhookMiddlewares,
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvbWlkZGxld2FyZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsOEVBQWtHO0FBS2hHLG1IQUxPLGdEQUFrQyxPQUtQO0FBSnBDLDhFQUFrRztBQUtoRyxtSEFMTyxnREFBa0MsT0FLUDtBQUpwQyxnRkFBb0c7QUFLbEcsbUhBTE8sZ0RBQWtDLE9BS1A7QUFHdkIsUUFBQSxvQkFBb0IsR0FBc0I7SUFDckQsR0FBRyxnREFBa0M7SUFDckMsR0FBRyxnREFBa0M7SUFDckMsR0FBRyxnREFBa0M7Q0FDdEMsQ0FBQyJ9