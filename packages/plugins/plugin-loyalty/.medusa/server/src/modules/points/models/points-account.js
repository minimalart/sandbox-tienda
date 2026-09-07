"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PointsAccount = void 0;
const utils_1 = require("@medusajs/framework/utils");
const points_transaction_1 = require("./points-transaction");
// One loyalty account per customer. `balance` is a denormalized cache of the
// AVAILABLE points (Σ of ledger entries with status='available', floored at 0),
// recomputed from the ledger on every write for fast reads. The ledger is the
// source of truth — see modules/points/service.ts.
exports.PointsAccount = utils_1.model.define('points_account', {
    id: utils_1.model
        .id({
        prefix: 'ptacc',
    })
        .primaryKey(),
    customer_id: utils_1.model.text().unique(),
    balance: utils_1.model.number().default(0),
    transactions: utils_1.model.hasMany(() => points_transaction_1.PointsTransaction, {
        mappedBy: 'account',
    }),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9pbnRzLWFjY291bnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9wb2ludHMvbW9kZWxzL3BvaW50cy1hY2NvdW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUFrRDtBQUNsRCw2REFBeUQ7QUFFekQsNkVBQTZFO0FBQzdFLGdGQUFnRjtBQUNoRiw4RUFBOEU7QUFDOUUsbURBQW1EO0FBQ3RDLFFBQUEsYUFBYSxHQUFHLGFBQUssQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUU7SUFDMUQsRUFBRSxFQUFFLGFBQUs7U0FDTixFQUFFLENBQUM7UUFDRixNQUFNLEVBQUUsT0FBTztLQUNoQixDQUFDO1NBQ0QsVUFBVSxFQUFFO0lBQ2YsV0FBVyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUU7SUFDbEMsT0FBTyxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLFlBQVksRUFBRSxhQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLHNDQUFpQixFQUFFO1FBQ25ELFFBQVEsRUFBRSxTQUFTO0tBQ3BCLENBQUM7Q0FDSCxDQUFDLENBQUMifQ==