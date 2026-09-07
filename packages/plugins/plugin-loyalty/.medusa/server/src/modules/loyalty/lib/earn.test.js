"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const earn_1 = require("./earn");
(0, node_test_1.test)('fixed awards a flat amount regardless of order total', () => {
    strict_1.default.equal((0, earn_1.computeEarnedPoints)({ calc_type: 'fixed', calc_value: 250 }, 9999), 250);
});
(0, node_test_1.test)('percentage: rate 10% of a $1000 order = 100 points', () => {
    strict_1.default.equal((0, earn_1.computeEarnedPoints)({ calc_type: 'percentage', calc_value: 10 }, 1000), 100);
});
(0, node_test_1.test)('multiplier: 1 point per currency unit', () => {
    strict_1.default.equal((0, earn_1.computeEarnedPoints)({ calc_type: 'multiplier', calc_value: 1 }, 1500), 1500);
});
(0, node_test_1.test)('campaign multiplier doubles the earned points', () => {
    strict_1.default.equal((0, earn_1.computeEarnedPoints)({ calc_type: 'percentage', calc_value: 10 }, 1000, 2), 200);
});
(0, node_test_1.test)('result is floored to whole points', () => {
    // 3.5% of 150 = 5.25 → 5
    strict_1.default.equal((0, earn_1.computeEarnedPoints)({ calc_type: 'percentage', calc_value: 3 }, 150), 4);
});
(0, node_test_1.test)('never returns negative points', () => {
    strict_1.default.equal((0, earn_1.computeEarnedPoints)({ calc_type: 'fixed', calc_value: -100 }, 0), 0);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWFybi50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvbG95YWx0eS9saWIvZWFybi50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEseUNBQWlDO0FBQ2pDLGdFQUF3QztBQUN4QyxpQ0FBNkM7QUFFN0MsSUFBQSxnQkFBSSxFQUFDLHNEQUFzRCxFQUFFLEdBQUcsRUFBRTtJQUNoRSxnQkFBTSxDQUFDLEtBQUssQ0FBQyxJQUFBLDBCQUFtQixFQUFDLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDeEYsQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFBLGdCQUFJLEVBQUMsb0RBQW9ELEVBQUUsR0FBRyxFQUFFO0lBQzlELGdCQUFNLENBQUMsS0FBSyxDQUFDLElBQUEsMEJBQW1CLEVBQUMsRUFBRSxTQUFTLEVBQUUsWUFBWSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUM1RixDQUFDLENBQUMsQ0FBQztBQUVILElBQUEsZ0JBQUksRUFBQyx1Q0FBdUMsRUFBRSxHQUFHLEVBQUU7SUFDakQsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsSUFBQSwwQkFBbUIsRUFBQyxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzVGLENBQUMsQ0FBQyxDQUFDO0FBRUgsSUFBQSxnQkFBSSxFQUFDLCtDQUErQyxFQUFFLEdBQUcsRUFBRTtJQUN6RCxnQkFBTSxDQUFDLEtBQUssQ0FBQyxJQUFBLDBCQUFtQixFQUFDLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQy9GLENBQUMsQ0FBQyxDQUFDO0FBRUgsSUFBQSxnQkFBSSxFQUFDLG1DQUFtQyxFQUFFLEdBQUcsRUFBRTtJQUM3Qyx5QkFBeUI7SUFDekIsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsSUFBQSwwQkFBbUIsRUFBQyxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3hGLENBQUMsQ0FBQyxDQUFDO0FBRUgsSUFBQSxnQkFBSSxFQUFDLCtCQUErQixFQUFFLEdBQUcsRUFBRTtJQUN6QyxnQkFBTSxDQUFDLEtBQUssQ0FBQyxJQUFBLDBCQUFtQixFQUFDLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNwRixDQUFDLENBQUMsQ0FBQyJ9