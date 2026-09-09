# Search Regression Seeds

These are canary seeds, not claims that the behaviors have been repaired.

| Seed | Example | Expected terminal class | Forbidden regression |
|---|---|---|---|
| Investor unspecified entity | “Is this financial advisor registered with the SEC?” | `CLARIFICATION` | Nationwide cohort dump |
| Move how-to vs entity | “How do I check if a moving company is licensed?” | how-to/guided verification; terminal outcome based on rendered next action | Treating “moving company” as a company name |
| Senior unspecified entity | “Is this home health agency Medicare certified?” | `CLARIFICATION` | Silent broad location search |
| Unsupported with action | Unsupported request with a valid official/specialist next step | `FAIL_CLOSED_WITH_ACTION` | Conflation with dead end |
| Unsupported dead end | Unsupported request without a defensible next step | `FAIL_CLOSED_DEAD_END` | Fabricated recommendation/result |
| Presentation intermittency | Identical requests in fresh sessions | stable result shape and explanation | HTTP-only test misses disappearing fail-closed explanation |

Future canaries must check interpretation, result shape, next-action presence, provenance and capability state—not merely HTTP status or freshness. Raw seed text must not enter ordinary product telemetry.
