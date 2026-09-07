import type { TenantConfig } from "./types";
import { defaultConfig } from "./default";

export function getDefaultTenant(): TenantConfig {
  return defaultConfig;
}

export function getTenantById(_id: string): TenantConfig {
  return defaultConfig;
}

export function getTenantByDomain(_domain: string): TenantConfig {
  return defaultConfig;
}

export function getAllTenants(): TenantConfig[] {
  return [defaultConfig];
}

export function getTenantNameById(_id: string): string {
  return defaultConfig.name;
}

export * from "./types";
export * from "./default";
