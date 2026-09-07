"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VimeoVideoModule = exports.VIMEO_VIDEO_MODULE = void 0;
var vimeo_video_1 = require("./modules/vimeo-video");
Object.defineProperty(exports, "VIMEO_VIDEO_MODULE", { enumerable: true, get: function () { return vimeo_video_1.VIMEO_VIDEO_MODULE; } });
var vimeo_video_2 = require("./modules/vimeo-video");
Object.defineProperty(exports, "VimeoVideoModule", { enumerable: true, get: function () { return __importDefault(vimeo_video_2).default; } });
/**
 * Este plugin NO expone setters propios. La coordinación con el host se
 * resuelve vía `@minimalart/mercatto-plugin-runtime`:
 *
 * - App-settings del namespace `extension:videos` → el plugin lee con
 *   `getAppSettingsSyncReader()`.
 *
 * El host registra el reader una vez al arrancar. Sin bridge, el plugin cae a
 * `process.env` — misma semántica que la extensión con snapshot vacío.
 */
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEscURBQTJEO0FBQWxELGlIQUFBLGtCQUFrQixPQUFBO0FBQzNCLHFEQUFvRTtBQUEzRCxnSUFBQSxPQUFPLE9BQW9CO0FBR3BDOzs7Ozs7Ozs7R0FTRyJ9