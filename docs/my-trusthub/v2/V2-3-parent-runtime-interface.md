# V2-3 parent runtime interface — implementation handoff

Baseline: Ask PR184 `b194642d56d31d90eeacd9458cf29266cfc6fc07`.
This branch is stacked on PR184. Production hold: no merge, deploy, signup,
configuration, credentials, permission grants or database application authorized.

## Specialist interface (freeze at this document's commit)

POST `/api/my-trusthub/profile-save`, JSON envelope:

```json
{"version":"v2-3/parent-runtime/1","operation":"commitProfileSave","input":{}}
```

The input above is illustrative: actual input must satisfy the exact named
operation from `lib/my-trusthub/contracts/v2-3-profile-transfer.ts` at this
commit. `lib/my-trusthub/profile-save/interface.ts` exports typed envelopes.
Success is `{ok:true, operation, result}`. Failure is `{ok:false,error}`;
no raw SQL/auth errors, subject IDs or session material in responses.
All requests are POST, body at most 64 KiB, no query parameters, no CORS,
no-store/no-referrer. Same-origin browser requests require verified Origin and
CSRF/session binding. Specialist server calls require independently verified
hub service identity, narrow scope and browser binding; body fields cannot
select a principal. Do not put transfer/context references in URLs or analytics.

| Operation | Required trusted caller | Result |
|---|---|---|
| prepareGuestProfileTransfer | Specialist BFF, transfer:stage, captured browser binding | Opaque transferRef, canonical manifestDigest, <=10-minute expiry |
| prepareProfileSaveContinuation | Same BFF/browser | Opaque continuationRef, no longer than stage expiry |
| consumeProfileSaveContinuation | Current admitted parent session + matching P13 exchange, explicit selection/destination confirmation | Server-generated accountContextRef, transferRef, manifestDigest |
| commitProfileSave | Current parent session, saved:write, matching grant | Durable ItemReceipt, separate parent/Project outcomes, localCopy:keep |
| getProfileSaveReceipt | Same current parent session/grant | Stored receipt or null; safe lost-response retry |
| verifyProfileSaveReceipt | Same parent grant plus BFF receipt:verify authority | Stored receipt only if exact manifest/item/revision/digest/Project matches |

Browser proof is supplied through the existing approved P13 browser-bound
exchange, not trusted because it appears in JSON. The authenticated channel
must resolve the current admitted parent subject and session on every request.
Legacy Move user IDs and SDK sessions do not substitute for parent identity.
Account switching invalidates grants; restart confirmation, never rebind them.

Builder 3: retain the Move guest storage contract and copies. Add explicit
"Keep this in My TrustHub" selection separately from local Save. Use selected
profile identities only, not notes, inventory, calculators or entire workspace
blobs. Treat unavailable/disabled as retained device data, never parent success.
Only server-verified matching receipts may show parent success. A partial
Project failure does not undo a durable Save; retry membership under a new
operation key without creating a second logical Save. No new Watch/Alert calls.

The runtime's storage boundary must atomically persist each mutation and its
receipt. P12 remains owner-authorized; P13 remains broker-authorized. No broad
service-role fallback or caller-supplied subject is permitted. Exact publication,
native-ID/class and network binding must be resolved from reviewed server data
at commit time, not copied from the browser or inferred from a slug/name/NMLS.

## Nonproduction enablement dependencies

HTTP path and wire types are frozen for adapter implementation; this is not an
endpoint availability or live-sync claim. Gate defaults OFF, production is
unconditionally rejected in this first-wave runtime. An approved isolated
parent/backend/origin pairing, current-session verifier, provisioned specialist
BFF identity, reviewed Move native-class/publication mapping, P13 exchange and
durable transactional storage binding are required before a deployed journey.
Missing adapters must return unavailable, never use an in-memory store in a
deployed route. Local harness identity/P12/P13 substitutes will be explicitly
labelled; they cannot certify real Auth, RLS or cross-domain synchronization.
