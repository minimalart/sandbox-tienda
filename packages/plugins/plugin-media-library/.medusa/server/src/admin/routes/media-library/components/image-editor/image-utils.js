"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDisplayImage = loadDisplayImage;
exports.loadExportImage = loadExportImage;
exports.smartCrop = smartCrop;
exports.centerCrop = centerCrop;
exports.exportImage = exportImage;
const smartcrop_1 = __importDefault(require("smartcrop"));
/** Carga una imagen para mostrar (directo, con crossOrigin para intentar CORS). */
function loadDisplayImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
        img.src = url;
    });
}
/**
 * Carga la imagen para EXPORTAR vía el proxy same-origin del backend, así el
 * canvas nunca queda "tainted" por CORS de S3 (toBlob no falla).
 */
function loadExportImage(url) {
    const proxied = `/admin/media-library/proxy?url=${encodeURIComponent(url)}`;
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo cargar la imagen (proxy)'));
        img.src = proxied;
    });
}
/** Smart crop: devuelve el mejor recorte (px naturales) para un aspect dado. */
async function smartCrop(img, aspect) {
    // smartcrop necesita un target w/h; usamos el aspect (o cuadrado por defecto).
    const a = aspect ?? 1;
    const w = a >= 1 ? 100 : Math.round(100 * a);
    const h = a >= 1 ? Math.round(100 / a) : 100;
    const result = await smartcrop_1.default.crop(img, { width: w, height: h });
    const c = result.topCrop;
    return { x: c.x, y: c.y, width: c.width, height: c.height };
}
/** Recorte centrado a un aspect dado (fallback cuando no hay crop manual/smart). */
function centerCrop(img, aspect) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!aspect)
        return { x: 0, y: 0, width: iw, height: ih };
    let w = iw;
    let h = Math.round(iw / aspect);
    if (h > ih) {
        h = ih;
        w = Math.round(ih * aspect);
    }
    return { x: Math.round((iw - w) / 2), y: Math.round((ih - h) / 2), width: w, height: h };
}
function targetSize(preset, rect, customW, customH) {
    if (customW && customH)
        return { w: customW, h: customH };
    if (preset.width && preset.height)
        return { w: preset.width, h: preset.height };
    if (preset.maxDim) {
        const max = Math.max(rect.width, rect.height);
        const scale = max > preset.maxDim ? preset.maxDim / max : 1;
        return { w: Math.round(rect.width * scale), h: Math.round(rect.height * scale) };
    }
    return { w: Math.round(rect.width), h: Math.round(rect.height) };
}
/** Downscale por pasos (mejor calidad que un solo drawImage en reducciones grandes). */
function drawHighQuality(ctx, img, rect, w, h) {
    // Si la reducción es grande, bajamos en pasos de 2x.
    let curW = rect.width;
    let curH = rect.height;
    let canvas = document.createElement('canvas');
    canvas.width = curW;
    canvas.height = curH;
    let c = canvas.getContext('2d');
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, curW, curH);
    while (curW > w * 2 || curH > h * 2) {
        const nextW = Math.max(w, Math.floor(curW / 2));
        const nextH = Math.max(h, Math.floor(curH / 2));
        const tmp = document.createElement('canvas');
        tmp.width = nextW;
        tmp.height = nextH;
        const tc = tmp.getContext('2d');
        tc.imageSmoothingEnabled = true;
        tc.imageSmoothingQuality = 'high';
        tc.drawImage(canvas, 0, 0, curW, curH, 0, 0, nextW, nextH);
        canvas = tmp;
        c = tc;
        curW = nextW;
        curH = nextH;
    }
    ctx.drawImage(canvas, 0, 0, curW, curH, 0, 0, w, h);
}
/** Aplica crop + resize y exporta a File (webp/jpeg) con calidad/smoothing. */
async function exportImage(opts) {
    const { exportImg, rect, preset, format, quality, smoothing, baseName, customW, customH } = opts;
    const { w, h } = targetSize(preset, rect, customW, customH);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('No se pudo crear el canvas');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = smoothing;
    const downscaleRatio = Math.min(w / rect.width, h / rect.height);
    if (smoothing === 'high' && downscaleRatio < 0.5) {
        drawHighQuality(ctx, exportImg, rect, w, h);
    }
    else {
        ctx.drawImage(exportImg, rect.x, rect.y, rect.width, rect.height, 0, 0, w, h);
    }
    const mime = format === 'webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
    if (!blob)
        throw new Error('No se pudo exportar la imagen');
    const ext = format === 'webp' ? 'webp' : 'jpg';
    const base = baseName.replace(/\.[^.]+$/, '');
    const file = new File([blob], `${base}__edited_${w}x${h}.${ext}`, { type: mime });
    return { file, width: w, height: h, bytes: blob.size };
}
