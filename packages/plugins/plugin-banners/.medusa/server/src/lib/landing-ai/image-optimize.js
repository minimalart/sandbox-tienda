"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizeToWebp = optimizeToWebp;
const sharp_1 = __importDefault(require("sharp"));
const TARGET_WIDTH = {
    hero: 1600,
    imageBlock: 1200,
};
async function optimizeToWebp(input, kind, opts) {
    const width = TARGET_WIDTH[kind];
    const quality = Math.min(Math.max(Math.round(opts.quality), 40), 90);
    const encode = (q) => (0, sharp_1.default)(input)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: q, effort: 4 })
        .toBuffer({ resolveWithObject: true });
    let { data, info } = await encode(quality);
    // Un solo step-down si nos pasamos del peso objetivo.
    if (data.length > opts.maxKb * 1024) {
        const lower = Math.max(quality - 15, 50);
        if (lower < quality) {
            const retry = await encode(lower);
            data = retry.data;
            info = retry.info;
        }
        if (data.length > opts.maxKb * 1024) {
            console.warn(`[landing-image] WebP ${kind} quedó en ${Math.round(data.length / 1024)}KB ` +
                `(objetivo ${opts.maxKb}KB).`);
        }
    }
    return {
        base64: data.toString('base64'),
        mimeType: 'image/webp',
        bytes: data.length,
        width: info.width,
        height: info.height,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2Utb3B0aW1pemUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbGliL2xhbmRpbmctYWkvaW1hZ2Utb3B0aW1pemUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUEwQkEsd0NBd0NDO0FBbEVELGtEQUEwQjtBQXFCMUIsTUFBTSxZQUFZLEdBQTZCO0lBQzdDLElBQUksRUFBRSxJQUFJO0lBQ1YsVUFBVSxFQUFFLElBQUk7Q0FDakIsQ0FBQztBQUVLLEtBQUssVUFBVSxjQUFjLENBQ2xDLEtBQWEsRUFDYixJQUFjLEVBQ2QsSUFBd0M7SUFFeEMsTUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2pDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUVyRSxNQUFNLE1BQU0sR0FBRyxDQUFDLENBQVMsRUFBRSxFQUFFLENBQzNCLElBQUEsZUFBSyxFQUFDLEtBQUssQ0FBQztTQUNULE1BQU0sRUFBRTtTQUNSLE1BQU0sQ0FBQyxFQUFFLEtBQUssRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsQ0FBQztTQUMzQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQztTQUMvQixRQUFRLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBRTNDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFM0Msc0RBQXNEO0lBQ3RELElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksRUFBRSxDQUFDO1FBQ3BDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxHQUFHLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUN6QyxJQUFJLEtBQUssR0FBRyxPQUFPLEVBQUUsQ0FBQztZQUNwQixNQUFNLEtBQUssR0FBRyxNQUFNLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNsQyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNsQixJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztRQUNwQixDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxFQUFFLENBQUM7WUFDcEMsT0FBTyxDQUFDLElBQUksQ0FDVix3QkFBd0IsSUFBSSxhQUFhLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSztnQkFDMUUsYUFBYSxJQUFJLENBQUMsS0FBSyxNQUFNLENBQ2hDLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztJQUVELE9BQU87UUFDTCxNQUFNLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUM7UUFDL0IsUUFBUSxFQUFFLFlBQVk7UUFDdEIsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNO1FBQ2xCLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSztRQUNqQixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07S0FDcEIsQ0FBQztBQUNKLENBQUMifQ==