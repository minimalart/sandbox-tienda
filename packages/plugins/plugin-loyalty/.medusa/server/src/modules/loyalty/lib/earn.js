"use strict";
// Pure earn-points math, isolated from the DB for unit testing (node --test).
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeEarnedPoints = computeEarnedPoints;
// Points earned for a rule given the eligible `amount` (same unit the ledger
// measures against). `multiplier` stacks a tier/campaign boost on top. Result is
// floored to whole points and never negative.
//
// Note (MVP): points are integers and multipliers are applied as integers
// (double/triple points). Fractional earn *rates* are expressed as a percentage
// rule (e.g. rate 0.1 = "1 point per $10" = calc_type 'percentage', calc_value 10).
function computeEarnedPoints(rule, amount, multiplier = 1) {
    const amt = Number(amount) || 0;
    const value = Number(rule.calc_value) || 0;
    const mult = Number(multiplier) || 1;
    let raw = 0;
    switch (rule.calc_type) {
        case 'fixed':
            raw = value;
            break;
        case 'percentage':
            raw = (amt * value) / 100;
            break;
        case 'multiplier':
            raw = amt * value;
            break;
        default:
            raw = 0;
    }
    return Math.max(0, Math.floor(raw * mult));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWFybi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2xveWFsdHkvbGliL2Vhcm4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLDhFQUE4RTs7QUFjOUUsa0RBeUJDO0FBaENELDZFQUE2RTtBQUM3RSxpRkFBaUY7QUFDakYsOENBQThDO0FBQzlDLEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUsZ0ZBQWdGO0FBQ2hGLG9GQUFvRjtBQUNwRixTQUFnQixtQkFBbUIsQ0FDakMsSUFBYyxFQUNkLE1BQWMsRUFDZCxVQUFVLEdBQUcsQ0FBQztJQUVkLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDaEMsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDM0MsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUVyQyxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFDWixRQUFRLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUN2QixLQUFLLE9BQU87WUFDVixHQUFHLEdBQUcsS0FBSyxDQUFDO1lBQ1osTUFBTTtRQUNSLEtBQUssWUFBWTtZQUNmLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUM7WUFDMUIsTUFBTTtRQUNSLEtBQUssWUFBWTtZQUNmLEdBQUcsR0FBRyxHQUFHLEdBQUcsS0FBSyxDQUFDO1lBQ2xCLE1BQU07UUFDUjtZQUNFLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFDWixDQUFDO0lBRUQsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQzdDLENBQUMifQ==