import { test } from "node:test";
import assert from "node:assert/strict";
import { enabledStoreB2B } from "./b2b-access";
import { resolveSiteFromParts } from "./resolve-site";
import { withSitePrefix } from "./site-path";
import type { TenantConfig } from "./types";

const tenant = (enabled: boolean, salesChannelId?: string) => ({ medusa: { b2b: { enabled, salesChannelId } } } as TenantConfig);
for (const [name, config] of [
  ["missing store", null],
  ["legacy config", { medusa: {} } as TenantConfig],
  ["disabled with existing resources", tenant(false, "sc_main")],
  ["incomplete provisioning", tenant(true)],
] as const) {
  test(name + " cannot open the portal", () => assert.equal(enabledStoreB2B(config), undefined));
}
for (const pathname of ["/b2b", "/b2b/login", "/b2b/register", "/b2b/orders", "/b2b/unknown/deep"]) {
  test(pathname + " belongs to main even with a child cookie", () => {
    const site = resolveSiteFromParts({ pathname, cookieSlug: "child" });
    assert.equal(site.slug, null);
    assert.equal(withSitePrefix("/", site.pathPrefix), "/");
    assert.equal(enabledStoreB2B(tenant(true, "sc_main"))?.salesChannelId, "sc_main");
  });
  test("disabled child " + pathname + " goes to its own home", () => {
    const site = resolveSiteFromParts({ pathname: "/tienda/child" + pathname });
    assert.equal(site.slug, "child");
    assert.equal(enabledStoreB2B(tenant(false, "sc_child")), undefined);
    assert.equal(withSitePrefix("/", site.pathPrefix), "/tienda/child");
  });
}
test("enabled child retains its own channel when main is disabled", () => {
  assert.equal(enabledStoreB2B(tenant(false, "sc_main")), undefined);
  assert.equal(enabledStoreB2B(tenant(true, "sc_child"))?.salesChannelId, "sc_child");
});
