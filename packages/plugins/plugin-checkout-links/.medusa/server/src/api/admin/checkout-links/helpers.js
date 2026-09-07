"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPublicUrl = buildPublicUrl;
exports.withPublicUrl = withPublicUrl;
/**
 * Builds the public storefront URL for a checkout link from the backend's
 * configured storefront origin. Falls back to a relative path when no origin is
 * configured (the admin can still prepend its own host if needed).
 */
function buildPublicUrl(link) {
    const base = (process.env.STOREFRONT_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        '').replace(/\/$/, '');
    const path = `/${link.country_code}/c/${link.token}`;
    return base ? `${base}${path}` : path;
}
function withPublicUrl(link) {
    return { ...link, public_url: buildPublicUrl(link) };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvYWRtaW4vY2hlY2tvdXQtbGlua3MvaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUtBLHdDQVdDO0FBRUQsc0NBSUM7QUF0QkQ7Ozs7R0FJRztBQUNILFNBQWdCLGNBQWMsQ0FBQyxJQUc5QjtJQUNDLE1BQU0sSUFBSSxHQUFHLENBQ1gsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjO1FBQzFCLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CO1FBQ2hDLEVBQUUsQ0FDSCxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDckIsTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsWUFBWSxNQUFNLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNyRCxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUN4QyxDQUFDO0FBRUQsU0FBZ0IsYUFBYSxDQUMzQixJQUFPO0lBRVAsT0FBTyxFQUFFLEdBQUcsSUFBSSxFQUFFLFVBQVUsRUFBRSxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztBQUN2RCxDQUFDIn0=