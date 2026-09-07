"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const ledger_1 = require("./ledger");
(0, node_test_1.test)('earns and redeems net out on available entries', () => {
    const balance = (0, ledger_1.computeAvailableBalance)([
        { amount: 100, status: 'available' },
        { amount: 50, status: 'available' },
        { amount: -30, status: 'available' },
    ]);
    strict_1.default.equal(balance, 120);
});
(0, node_test_1.test)('pending / expired / reversed entries do not count', () => {
    const balance = (0, ledger_1.computeAvailableBalance)([
        { amount: 100, status: 'available' },
        { amount: 500, status: 'pending' },
        { amount: 200, status: 'expired' },
        { amount: 300, status: 'reversed' },
    ]);
    strict_1.default.equal(balance, 100);
});
(0, node_test_1.test)('a missing status is treated as available (legacy rows)', () => {
    const balance = (0, ledger_1.computeAvailableBalance)([
        { amount: 100 },
        { amount: -40, status: null },
    ]);
    strict_1.default.equal(balance, 60);
});
(0, node_test_1.test)('reverse / expire entries subtract from the balance', () => {
    const balance = (0, ledger_1.computeAvailableBalance)([
        { amount: 100, status: 'available' }, // earn
        { amount: -100, status: 'available' }, // reverse of the earn
    ]);
    strict_1.default.equal(balance, 0);
});
(0, node_test_1.test)('balance is floored at 0 even if the raw sum goes negative', () => {
    const entries = [
        { amount: 100, status: 'available' }, // earn
        { amount: -100, status: 'available' }, // redeem (spent)
        { amount: -100, status: 'available' }, // reverse of the earn after it was spent
    ];
    strict_1.default.equal((0, ledger_1.sumAvailable)(entries), -100);
    strict_1.default.equal((0, ledger_1.computeAvailableBalance)(entries), 0);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGVkZ2VyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9wb2ludHMvbGliL2xlZGdlci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEseUNBQWlDO0FBQ2pDLGdFQUF3QztBQUN4QyxxQ0FBaUU7QUFFakUsSUFBQSxnQkFBSSxFQUFDLGdEQUFnRCxFQUFFLEdBQUcsRUFBRTtJQUMxRCxNQUFNLE9BQU8sR0FBRyxJQUFBLGdDQUF1QixFQUFDO1FBQ3RDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFO1FBQ3BDLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFO1FBQ25DLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUU7S0FDckMsQ0FBQyxDQUFDO0lBQ0gsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzdCLENBQUMsQ0FBQyxDQUFDO0FBRUgsSUFBQSxnQkFBSSxFQUFDLG1EQUFtRCxFQUFFLEdBQUcsRUFBRTtJQUM3RCxNQUFNLE9BQU8sR0FBRyxJQUFBLGdDQUF1QixFQUFDO1FBQ3RDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFO1FBQ3BDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFO1FBQ2xDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFO1FBQ2xDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFO0tBQ3BDLENBQUMsQ0FBQztJQUNILGdCQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQztBQUM3QixDQUFDLENBQUMsQ0FBQztBQUVILElBQUEsZ0JBQUksRUFBQyx3REFBd0QsRUFBRSxHQUFHLEVBQUU7SUFDbEUsTUFBTSxPQUFPLEdBQUcsSUFBQSxnQ0FBdUIsRUFBQztRQUN0QyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUU7UUFDZixFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFO0tBQzlCLENBQUMsQ0FBQztJQUNILGdCQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztBQUM1QixDQUFDLENBQUMsQ0FBQztBQUVILElBQUEsZ0JBQUksRUFBQyxvREFBb0QsRUFBRSxHQUFHLEVBQUU7SUFDOUQsTUFBTSxPQUFPLEdBQUcsSUFBQSxnQ0FBdUIsRUFBQztRQUN0QyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLE9BQU87UUFDN0MsRUFBRSxNQUFNLEVBQUUsQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLHNCQUFzQjtLQUM5RCxDQUFDLENBQUM7SUFDSCxnQkFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDM0IsQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFBLGdCQUFJLEVBQUMsMkRBQTJELEVBQUUsR0FBRyxFQUFFO0lBQ3JFLE1BQU0sT0FBTyxHQUFHO1FBQ2QsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsRUFBRSxPQUFPO1FBQzdDLEVBQUUsTUFBTSxFQUFFLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsRUFBRSxpQkFBaUI7UUFDeEQsRUFBRSxNQUFNLEVBQUUsQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLHlDQUF5QztLQUNqRixDQUFDO0lBQ0YsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsSUFBQSxxQkFBWSxFQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDMUMsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsSUFBQSxnQ0FBdUIsRUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNwRCxDQUFDLENBQUMsQ0FBQyJ9