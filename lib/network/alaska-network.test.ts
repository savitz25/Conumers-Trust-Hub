import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import manifest from "../../data/network/alaska-publication-manifest.json" with { type: "json" };
import { akReleaseGatePassed, akSpecialistUrl } from "./alaska-network.ts";
import {
  ASK_PUBLISHED_STATE_CATALOG,
  askPublishedStatewideSlugs,
  askStateExplorerEyebrow,
} from "./published-ask-states.ts";

test("Alaska Ask gateway exposes six live specialists without a combined total", () => {
  const page = readFileSync("app/alaska/page.tsx", "utf8");
  const component = readFileSync(
    "components/alaska-network-gateway.tsx",
    "utf8",
  );
  assert.equal(akReleaseGatePassed(), true);
  assert.equal(manifest.hubs.length, 6);
  assert.equal(new Set(manifest.hubs.map((hub) => hub.hub_id)).size, 6);
  assert.equal(akSpecialistUrl("move"), "https://www.movetrusthub.com/alaska");
  assert.equal(manifest.publication_limits.cross_hub_record_total, null);
  assert.equal(
    manifest.publication_limits.cross_hub_record_total_status,
    "REJECTED",
  );
  assert.equal(manifest.publication_limits.ratings, "NOT_ESTABLISHED");
  assert.equal(manifest.publication_limits.trust_score, "NOT_ESTABLISHED");
  assert.equal(manifest.publication_limits.ask_graph_writes, 0);
  assert.equal(
    askPublishedStatewideSlugs().filter((slug) => slug === "alaska").length,
    1,
  );
  assert.equal(
    askStateExplorerEyebrow(),
    `${ASK_PUBLISHED_STATE_CATALOG.length}-state network explorer`,
  );
  assert.match(page, /path: "\/alaska"/);
  assert.match(component, /manifest\.hubs\.map/);
  assert.match(component, /Open \{hub\.hub_name\} Alaska/);
  assert.match(component, /NOT_ACQUIRED/);
  assert.match(component, /Trust Scores/);
  assert.equal(
    ASK_PUBLISHED_STATE_CATALOG.filter((state) => state.slug === "alaska")
      .length,
    1,
  );
});
