// Independent actual-module check. Set LENDER_REVIEW_ROOT to immutable #52 checkout.
// Supabase and active storage owner are in-memory mocks; no external requests.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const root = process.env.LENDER_REVIEW_ROOT;
if (!root) throw new Error('LENDER_REVIEW_ROOT required');
const { build } = createRequire(resolve(root, 'package.json'))('esbuild');
const mocks = {
  '@/lib/my-lending/storage': `export const getMyLendingStorageUserId=()=>state.owner; export const getStateMaxUpdatedAt=()=> '2026-01-01';
    export const loadState=()=>({version:3,plans:[],savedLenders:[]}); export const isMyLendingStateEmpty=()=>true; export const replaceStateFromRemote=()=>true;`,
  '@/lib/supabase/client': `export const createBrowserSupabaseClient=()=>({from:()=>({upsert:row=>{state.rows.push(row);return new Promise(done=>state.complete=done)}})});`,
};
const bundle = await build({ stdin: { contents: `export {pushMyLendingWorkspace} from './lib/my-lending/sync'`, resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'cjs', plugins: [{name:'isolated',setup(b){
    b.onResolve({filter:/.*/},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:null);
    b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));
  }}] });
test('B4-L2 completion after owner switch must not report current-account sync success', async () => {
  const state = { owner: 'owner-a', rows: [], complete: null };
  const fixtureModule = { exports: {} };
  runInNewContext(bundle.outputFiles[0].text, { state, module: fixtureModule, exports: fixtureModule.exports, console, setTimeout, clearTimeout });
  const pending = fixtureModule.exports.pushMyLendingWorkspace('owner-a');
  assert.equal(state.rows[0].user_id, 'owner-a');
  state.owner = 'owner-b'; state.complete({error:null});
  assert.equal(await pending, 'skipped', 'Old-owner completion cannot be current-owner acknowledgment');
});
