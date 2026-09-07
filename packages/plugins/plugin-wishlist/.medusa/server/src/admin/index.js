"use strict";
require("@medusajs/admin-shared");
const widgetModule = { widgets: [] };
const routeModule = {
  routes: []
};
const menuItemModule = {
  menuItems: []
};
const formModule = { customFields: {} };
const displayModule = {
  displays: {}
};
const i18nModule = { resources: {} };
const cellRendererModule = {};
const layoutModule = { layouts: [] };
const plugin = {
  widgetModule,
  routeModule,
  menuItemModule,
  formModule,
  displayModule,
  i18nModule,
  cellRendererModule,
  layoutModule
};
module.exports = plugin;
