# Growth Campaigns V1

Campaigns are internal attribution objects with immutable IDs and editable names. Channels are EMAIL, MANUAL_OUTREACH, PARTNER, and OTHER; statuses are DRAFT, ACTIVE, PAUSED, COMPLETED, and ARCHIVED. `ADMIN_VIEW` reads aggregates; `GROWTH_OPS` creates or changes campaigns. Writes are Admin-audited.

Targets use an exact published `ath_hub_profiles` identity or a bounded external reference, never a fuzzy name. An opaque token resolves only to a constrained `/claim` route. It records a click and sets an HTTP-only attribution cookie; it does not authenticate, authorize, grant membership, prove authority, change claim policy, or affect ranking. Claim attribution is first-touch V1 and one row per claim.

Pause prevents new target/link generation and future send-adapter eligibility. It does not recall delivered messages; existing non-archived links remain safe attribution redirects. No sender is connected and no campaign is sent by ATH-ADMIN-005.

Provider evidence status: clicks LIVE; claim/approval records LIVE; activation LIVE only after its instrumentation epoch; sent, delivered, opened, bounce, and complaint NOT_CONNECTED. Unconnected metrics are never rendered as zero.

Marketing suppression stores only a normalized one-way contact hash and a reason. Unsubscribe is opaque, idempotent, and marketing-only. It does not disable magic links, claim decisions, security messages, or requested regulatory monitoring. A sending integration must later audit domain reputation, suppression enforcement, unsubscribe, bounce/complaint webhooks, provider limits, and rollback before launch.

Privacy: campaign tables do not store raw Search questions, sessions, magic links, consumer Saves, consumer Watches, Projects, private notes, or arbitrary metadata. Layer A evidence and claim governance are independent of campaign and acquisition source.
