# Monitoring and Alert Health

The only active network event adapter proven in Ask is the signed Contractor Florida DBPR feed. It retains its exact event contract and native profile grain. The daily collector records a heartbeat for a successful empty poll without advancing a sequence artificially: **NO CHANGE is not NO CHECK**. A failed poll or contract mismatch records DEGRADED and opens/deduplicates an incident.

`ath_monitoring_subscriptions` is exact organization plus profile intent. Only Contractor/Florida DBPR currently has an event feed. Other subscriptions/capabilities must be described as unavailable or unsupported rather than “active monitoring.” Blast radius is aggregate active subscriptions, distinct managed profiles, and organizations. Unified consumer Watch impact is UNKNOWN.

Alert stages remain separate: event received, subscription matched, notification created, in-app unread, email pending, provider accepted, failed. Existing `SENT` means the email API accepted the request; it is not authoritative delivery. Email failure never changes source health.
