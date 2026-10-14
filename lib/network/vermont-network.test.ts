import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import manifest from "../../data/network/vermont-publication-manifest.json" with { type: "json" };
import { vtReleaseGatePassed, vtSpecialistUrl } from "./vermont-network.ts";
import { ASK_PUBLISHED_STATE_CATALOG, askPublishedStatewideSlugs, askStateExplorerEyebrow } from "./published-ask-states.ts";

test("Vermont Ask gateway links six live specialists without combined totals", () => {
  const page = readFileSync("app/vermont/page.tsx", "utf8");
  const component = readFileSync("components/vermont-network-gateway.tsx", "utf8");
  assert.equal(vtReleaseGatePassed(), true);
  assert.equal(manifest.hubs.length, 6);
  assert.equal(new Set(manifest.hubs.map((hub) => hub.hub_id)).size, 6);
  assert.equal(vtSpecialistUrl("move"), "https://www.movetrusthub.com/vermont");
  assert.equal(manifest.publication_limits.cross_hub_record_total, null);
  assert.equal(manifest.publication_limits.cross_hub_record_total_status, "REJECTED");
  assert.equal(manifest.publication_limits.ratings, "NOT_ESTABLISHED");
  assert.equal(manifest.publication_limits.trust_score, "NOT_ESTABLISHED");
  assert.equal(manifest.publication_limits.ask_graph_writes, 0);
  assert.equal(askPublishedStatewideSlugs().filter((slug) => slug === "vermont").length, 1);
  assert.equal(askStateExplorerEyebrow(), `${ASK_PUBLISHED_STATE_CATALOG.length}-state network explorer`);
  assert.match(page, /path: "\/vermont"/);
  assert.match(component, /manifest\.hubs\.map/);
  assert.match(component, /Open \{hub\.hub_name\} Vermont/);
  assert.match(component, /NOT_ACQUIRED/);
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.filter((state) => state.slug === "vermont").length, 1);
});
