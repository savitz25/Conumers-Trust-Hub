# Contractor trial capacity target

Internal goal: first staff action within **48 business hours** for invited Florida Contractor claims. The clock starts at successful submission, pauses while status is `needs_info`, and resumes when the claimant responds. It is not a contractual or public SLA.

Review oldest eligible claims first, with conflicts and possible wrongful control escalated immediately. If the queue exceeds the target, stop expanding invitations, clear aged work, document cause/capacity, and resume only when the handheld review load is controlled.

Current server caps: claim submission 8/user/hour; record issues 5/user-profile/hour and 10 concurrently open; record-issue follow-ups 10/user-profile/hour; business-response creation 10/user-profile/hour and subsequent actions 15/user-profile/hour; invitations 20/actor/hour, 5/org-recipient/day, and resend 3/invitation/day. Staff review is 60/staff/hour. Customer UIs must translate rate-limit failures into retry guidance.
