"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const permissions_1 = require("../permissions");
async function GET(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await (0, permissions_1.resolveGiftCardAdminPermissions)(req));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dpZnQtY2FyZC1leHBlcmllbmNlL3Blcm1pc3Npb25zL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBR0Esa0JBR0M7QUFMRCxnREFBaUU7QUFFMUQsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQzNDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFBLDZDQUErQixFQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDdkQsQ0FBQyJ9