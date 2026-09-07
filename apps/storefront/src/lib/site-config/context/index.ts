export * from "./site-config-context";
// Helpers de rutas del sitio: se reexportan acá (además de en
// @lib/site-config/site-path) para que los call sites cliente los tomen del mismo
// lugar que los hooks.
export { stripSitePrefix, withSitePrefix } from "../site-path";
