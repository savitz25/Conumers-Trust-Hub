import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import manifest from "../../data/network/wyoming-publication-manifest.json" with { type: "json" };
import { wyReleaseGatePassed, wySpecialistUrl } from "./wyoming-network.ts";
import { ASK_PUBLISHED_STATE_CATALOG, askPublishedStatewideSlugs, askStateExplorerEyebrow } from "./published-ask-states.ts";

test("Wyoming Ask gateway links six live specialists without combined totals", () => {
  const page = readFileSync("app/wyoming/page.tsx", "utf8");
  const component = readFileSync("components/wyoming-network-gateway.tsx", "utf8");
  assert.equal(wyReleaseGatePassed(), true);
  assert.equal(manifest.hubs.length, 6);
  assert.equal(new Set(manifest.hubs.map((hub) => hub.hub_id)).size, 6);
  assert.equal(wySpecialistUrl("move"), "https://www.movetrusthub.com/wyoming");
  assert.equal(manifest.publication_limits.cross_hub_record_total, null);
  assert.equal(manifest.publication_limits.cross_hub_record_total_status, "REJECTED");
  assert.equal(manifest.publication_limits.ratings, "NOT_ESTABLISHED");
  assert.equal(manifest.publication_limits.trust_score, "NOT_ESTABLISHED");
  assert.equal(manifest.publication_limits.ask_graph_writes, 0);
  assert.equal(askPublishedStatewideSlugs().filter((slug) => slug === "wyoming").length, 1);
  assert.equal(askStateExplorerEyebrow(), `${ASK_PUBLISHED_STATE_CATALOG.length}-state network explorer`);
  assert.match(page, /path: "\/wyoming"/);
  assert.match(component, /manifest\.hubs\.map/);
  assert.match(component, /Open \{hub\.hub_name\} Wyoming/);
  assert.match(component, /NOT_ACQUIRED/);
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.filter((state) => state.slug === "wyoming").length, 1);
});
