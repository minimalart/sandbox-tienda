"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditAction = exports.BannerPlacement = exports.BannerDeviceType = exports.BannerType = exports.BannerStatus = void 0;
var BannerStatus;
(function (BannerStatus) {
    BannerStatus["DRAFT"] = "draft";
    BannerStatus["PUBLISHED"] = "published";
    BannerStatus["ARCHIVED"] = "archived";
})(BannerStatus || (exports.BannerStatus = BannerStatus = {}));
var BannerType;
(function (BannerType) {
    BannerType["HERO"] = "hero";
    BannerType["ANNOUNCEMENT"] = "announcement";
    BannerType["STRIP"] = "strip";
    BannerType["CARD"] = "card";
    BannerType["MODAL"] = "modal";
})(BannerType || (exports.BannerType = BannerType = {}));
var BannerDeviceType;
(function (BannerDeviceType) {
    BannerDeviceType["ALL"] = "all";
    BannerDeviceType["MOBILE"] = "mobile";
    BannerDeviceType["DESKTOP"] = "desktop";
    BannerDeviceType["TABLET"] = "tablet";
})(BannerDeviceType || (exports.BannerDeviceType = BannerDeviceType = {}));
var BannerPlacement;
(function (BannerPlacement) {
    BannerPlacement["TOP_BAR"] = "top_bar";
    BannerPlacement["BANNER_1"] = "banner_1";
    BannerPlacement["BANNER_2"] = "banner_2";
    BannerPlacement["BANNER_3"] = "banner_3";
    BannerPlacement["BANNER_4"] = "banner_4";
    BannerPlacement["BANNER_5"] = "banner_5";
    BannerPlacement["BANNER_6"] = "banner_6";
})(BannerPlacement || (exports.BannerPlacement = BannerPlacement = {}));
var AuditAction;
(function (AuditAction) {
    AuditAction["CREATED"] = "created";
    AuditAction["UPDATED"] = "updated";
    AuditAction["PUBLISHED"] = "published";
    AuditAction["UNPUBLISHED"] = "unpublished";
    AuditAction["ARCHIVED"] = "archived";
    AuditAction["DELETED"] = "deleted";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9iYW5uZXIvdHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsSUFBWSxZQUlYO0FBSkQsV0FBWSxZQUFZO0lBQ3RCLCtCQUFlLENBQUE7SUFDZix1Q0FBdUIsQ0FBQTtJQUN2QixxQ0FBcUIsQ0FBQTtBQUN2QixDQUFDLEVBSlcsWUFBWSw0QkFBWixZQUFZLFFBSXZCO0FBRUQsSUFBWSxVQU1YO0FBTkQsV0FBWSxVQUFVO0lBQ3BCLDJCQUFhLENBQUE7SUFDYiwyQ0FBNkIsQ0FBQTtJQUM3Qiw2QkFBZSxDQUFBO0lBQ2YsMkJBQWEsQ0FBQTtJQUNiLDZCQUFlLENBQUE7QUFDakIsQ0FBQyxFQU5XLFVBQVUsMEJBQVYsVUFBVSxRQU1yQjtBQUVELElBQVksZ0JBS1g7QUFMRCxXQUFZLGdCQUFnQjtJQUMxQiwrQkFBVyxDQUFBO0lBQ1gscUNBQWlCLENBQUE7SUFDakIsdUNBQW1CLENBQUE7SUFDbkIscUNBQWlCLENBQUE7QUFDbkIsQ0FBQyxFQUxXLGdCQUFnQixnQ0FBaEIsZ0JBQWdCLFFBSzNCO0FBRUQsSUFBWSxlQVFYO0FBUkQsV0FBWSxlQUFlO0lBQ3pCLHNDQUFtQixDQUFBO0lBQ25CLHdDQUFxQixDQUFBO0lBQ3JCLHdDQUFxQixDQUFBO0lBQ3JCLHdDQUFxQixDQUFBO0lBQ3JCLHdDQUFxQixDQUFBO0lBQ3JCLHdDQUFxQixDQUFBO0lBQ3JCLHdDQUFxQixDQUFBO0FBQ3ZCLENBQUMsRUFSVyxlQUFlLCtCQUFmLGVBQWUsUUFRMUI7QUFxRkQsSUFBWSxXQU9YO0FBUEQsV0FBWSxXQUFXO0lBQ3JCLGtDQUFtQixDQUFBO0lBQ25CLGtDQUFtQixDQUFBO0lBQ25CLHNDQUF1QixDQUFBO0lBQ3ZCLDBDQUEyQixDQUFBO0lBQzNCLG9DQUFxQixDQUFBO0lBQ3JCLGtDQUFtQixDQUFBO0FBQ3JCLENBQUMsRUFQVyxXQUFXLDJCQUFYLFdBQVcsUUFPdEIifQ==