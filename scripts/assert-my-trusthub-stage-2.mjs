import { readFileSync } from "node:fs";

let checks = 0;
function read(path) { return readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }
function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error(`Stage 2 assertion failed: ${message}`);
}

const actions = read("app/my/actions.ts");
const adapter = read("lib/my-trusthub/production-adapter.ts");
const shell = read("components/my-trusthub/my-shell.tsx");
const home = read("app/my/page.tsx");
const saved = read("app/my/saved/page.tsx");
const projects = read("app/my/projects/page.tsx");
const project = read("app/my/projects/[projectId]/page.tsx");
const you = read("app/my/you/page.tsx");
const guest = read("components/my-trusthub/guest-restore.tsx");
const layout = read("app/my/layout.tsx");
const css = read("app/my/my.css");

for (const [label, href] of [["Home", "/my"], ["Projects", "/my/projects"], ["Saved", "/my/saved"], ["You", "/my/you"]]) {
  assert(shell.includes(`["${label}", "${href}"`), `${label} navigation is registered`);
}
assert(!shell.includes("/my/watches") && !shell.includes("/my/alerts"), "Watch and Alerts stay out of navigation");
assert(home.includes("Unfiled research") && home.includes("Recent activity"), "Home exposes real workspace summaries");
assert(projects.includes("createProjectAction"), "Project creation remains available");
assert(project.includes("updateProjectAction") && project.includes("archiveProjectAction") && project.includes("restoreProjectAction"), "Project lifecycle includes edit/archive/restore");
assert(project.includes("addSavedToProjectAction") && project.includes("removeSavedFromProjectAction"), "Project membership is reversible");
assert(adapter.includes('rpc("update_project"'), "Project edits use the narrow P12 RPC");
assert(saved.includes("activeProjects.map") && saved.includes("item.project_ids.includes"), "Saved Research supports many-to-many assignment");
assert(saved.includes("createPrivateNoteAction") && saved.includes("updatePrivateNoteAction") && saved.includes("deletePrivateNoteAction"), "private note lifecycle is exposed");
assert(adapter.includes('rpc("create_note"') && adapter.includes('rpc("update_note"') && adapter.includes('rpc("delete_note"'), "private notes use P12 RPCs");
assert(guest.includes("mytrusthub:guest-research:v1"), "guest state remains device-local before consent");
assert(guest.includes("previewGuestImportAction") && guest.includes("commitGuestImportAction"), "guest restore has preview and explicit commit");
assert(actions.includes('rpc') === false, "server actions do not bypass the production adapter");
assert(adapter.includes('rpc("preview_guest_import"') && adapter.includes('rpc("commit_guest_import"'), "guest restore uses P12 database contract");
assert(actions.includes("p_selected_item_ids") === false, "database argument details stay in the adapter");
assert(you.includes("Separate from Business Manager") && you.includes("Private by design"), "You page states privacy and business separation");
assert(!you.includes("MY_TRUSTHUB_WATCH_ENABLED") && !you.includes("MY_TRUSTHUB_ALERTS_ENABLED"), "You page exposes no inactive later-stage controls");
assert(layout.includes("index: false") && layout.includes("noarchive: true"), "workspace stays noindex/noarchive");
assert(css.includes(":focus-visible") && css.includes("max-width: 520px"), "focus and narrow viewport rules remain present");
assert(actions.includes('assertMyTrustHubFeature("MY_TRUSTHUB_ENABLED")') || actions.includes("requiredAdapter"), "mutations remain behind authenticated workspace access");
assert(![home, saved, projects, project, you, guest].join("\n").match(/Boca|fixture provider|demo company/i), "no fake provider fixture appears in Stage 2 UI");

console.log(`My TrustHub Stage 2 assertions: ${checks}/${checks} PASS`);
